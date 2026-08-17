import SwiftUI
import SpasiBohCore

/// The scenarios available to this learner.
///
/// Filtered by direction, not sorted by it: a scenario set in a Moscow metro
/// station teaches nothing to someone learning Italian.
struct ScenarioListView: View {
    @Environment(AppSettings.self) private var settings
    @Environment(ProgressModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    @State private var running: Scenario?

    private var direction: Direction { settings.direction ?? .itToRu }
    private var ui: Language { direction.native }

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()
                ScrollView {
                    VStack(spacing: 12) {
                        ForEach(model.content.scenarios(for: direction)) { scenario in
                            Button {
                                running = scenario
                            } label: {
                                card(scenario)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(18)
                }
            }
            .navigationTitle(S.scenarios(ui))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button(S.close(ui)) { dismiss() }
                }
            }
            .fullScreenCover(item: $running) { scenario in
                ScenarioRunnerView(scenario: scenario)
            }
        }
    }

    private func card(_ scenario: Scenario) -> some View {
        let completion = progressOf(scenario)
        return HStack(spacing: 14) {
            Image(systemName: scenario.symbolName)
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(Theme.accent)
                .frame(width: 34)
            VStack(alignment: .leading, spacing: 5) {
                Text(scenario.title(ui))
                    .font(.headline)
                    .foregroundStyle(Theme.textPrimary)
                Text(scenario.intro(ui))
                    .font(.footnote)
                    .foregroundStyle(Theme.textSecondary)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
                MasteryBar(value: completion)
                    .padding(.top, 2)
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(Theme.textTertiary)
        }
        .cardSurface()
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(scenario.title(ui)). \(Int(completion * 100))%")
    }

    private func progressOf(_ scenario: Scenario) -> Double {
        let steps = scenario.answerableSteps
        guard !steps.isEmpty else { return 0 }
        let total = steps.reduce(0.0) { sum, step in
            sum + model.progress.mastery(of: ItemScope(
                direction: direction, kind: .sentence, itemID: ScenarioRunnerView.itemID(scenario, step)
            ))
        }
        return total / Double(steps.count)
    }
}

/// Plays one scenario as a short dialogue.
///
/// Steps are converted into ordinary `Exercise` values and rendered by the same
/// card as everything else. A parallel scenario-only exercise renderer would be
/// a second place for answer checking and accessibility to drift.
struct ScenarioRunnerView: View {
    let scenario: Scenario

    @Environment(AppSettings.self) private var settings
    @Environment(ProgressModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    @State private var index = 0
    @State private var phase: SessionRunner.Phase = .answering
    @State private var answered = 0
    @State private var correct = 0
    @State private var speaker: any Speaking = SpeechSynthesizer()
    @State private var listener: any Listening = SpeechRecognizerService()

    private var direction: Direction { settings.direction ?? .itToRu }
    private var ui: Language { direction.native }
    private var steps: [ScenarioStep] { scenario.steps }

    /// Scenario answers are tracked as sentence progress under a namespaced id,
    /// so they feed the same schedule as everything else and the `scenario_`
    /// prefix stays greppable for the achievement.
    static func itemID(_ scenario: Scenario, _ step: ScenarioStep) -> String {
        "scenario_\(scenario.id)_\(step.id)"
    }

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            VStack(spacing: 0) {
                header
                if index < steps.count {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 16) {
                            if let line = npcLine(steps[index]) {
                                NPCBubble(text: line.text, subtitle: line.pronunciation) {
                                    speaker.speak(AudioCue(text: line.spokenText, language: direction.target), slow: $0)
                                }
                            }
                            Text(steps[index].prompt(ui))
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(Theme.textSecondary)

                            if let exercise = exercise(for: steps[index]) {
                                ExerciseCard(
                                    exercise: exercise, ui: ui, phase: phase,
                                    speaker: speaker, listener: listener
                                ) { isCorrect, _ in
                                    submit(exercise: exercise, correct: isCorrect)
                                }
                                .id(exercise.id)
                            } else {
                                Button(S.next(ui)) { advance() }
                                    .buttonStyle(PrimaryButtonStyle())
                            }

                            if case .feedback = phase {
                                Button(S.next(ui)) { advance() }
                                    .buttonStyle(PrimaryButtonStyle())
                            }
                        }
                        .padding(18)
                    }
                } else {
                    completion
                }
            }
        }
        .task { speakCurrent() }
        .onDisappear { speaker.stop(); listener.stop() }
    }

    private var header: some View {
        HStack(spacing: 14) {
            Button { dismiss() } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Theme.textSecondary)
                    .frame(width: Theme.tapTarget, height: Theme.tapTarget)
            }
            .accessibilityLabel(S.close(ui))
            ProgressView(value: Double(index) / Double(max(steps.count, 1)))
                .tint(Theme.accent)
            Text(scenario.title(ui))
                .font(.footnote.weight(.semibold))
                .foregroundStyle(Theme.textSecondary)
                .lineLimit(1)
                .padding(.trailing, 14)
        }
    }

    private var completion: some View {
        VStack(spacing: 18) {
            Spacer()
            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 54))
                .foregroundStyle(Theme.accent)
            Text(S.scenarioComplete(ui))
                .font(.title3.weight(.bold))
                .foregroundStyle(Theme.textPrimary)
            Text("\(correct)/\(max(answered, 1))")
                .font(.system(size: 30, weight: .bold, design: .rounded).monospacedDigit())
                .foregroundStyle(Theme.textSecondary)
            Spacer()
            Button(S.backToHome(ui)) { dismiss() }
                .buttonStyle(PrimaryButtonStyle())
                .padding(.horizontal, 20)
                .padding(.bottom, 30)
        }
    }

    private func npcLine(_ step: ScenarioStep) -> LanguageSide? {
        step.npc(direction.target)
    }

    /// Turn a step into an exercise. `info` steps have no answer.
    private func exercise(for step: ScenarioStep) -> Exercise? {
        let key = ProgressKey(
            direction: direction, kind: .sentence,
            itemID: Self.itemID(scenario, step), skill: skill(for: step.kind)
        )
        let target = step.target(direction.target)

        switch step.kind {
        case .info:
            return nil

        case .comprehension, .choice:
            // Comprehension options are in the learner's own language; choice
            // options are in the target language, because picking the right
            // thing to *say* is the exercise.
            let language = step.kind == .comprehension ? direction.native : direction.target
            let texts = step.options(language)
            guard let answer = step.correctOption, texts.indices.contains(answer) else { return nil }
            return Exercise(
                id: "\(scenario.id)-\(step.id)", kind: .sentenceReply, key: key,
                promptText: "", promptLanguage: language,
                options: texts.enumerated().map { ExerciseOption(id: $0.offset, text: $0.element, language: language) },
                correctOption: answer,
                note: step.hint
            )

        case .build:
            guard let target else { return nil }
            let words = target.text.split(whereSeparator: \.isWhitespace).map(String.init)
            guard words.count >= 2 else { return nil }
            var generator = SeededGenerator(seed: "\(scenario.id)-\(step.id)")
            return Exercise(
                id: "\(scenario.id)-\(step.id)", kind: .sentenceBuild, key: key,
                promptText: step.target(direction.native)?.text ?? "",
                promptLanguage: direction.native,
                expected: target.text, expectedLanguage: direction.target,
                blocks: (words + step.distractors(for: direction.target)).shuffled(using: &generator),
                audio: AudioCue(text: target.spokenText, language: direction.target),
                note: step.hint
            )

        case .pronounce:
            guard let target else { return nil }
            return Exercise(
                id: "\(scenario.id)-\(step.id)", kind: .pronunciation, key: key,
                promptText: target.text,
                promptSubtitle: target.pronunciation ?? step.target(direction.native)?.text,
                promptLanguage: direction.target,
                expected: target.text, expectedLanguage: direction.target,
                audio: AudioCue(text: target.spokenText, language: direction.target),
                note: step.hint
            )
        }
    }

    private func skill(for kind: ScenarioStepKind) -> Skill {
        switch kind {
        case .comprehension: .listening
        case .build, .choice, .info: .sentenceUsage
        case .pronounce: .pronunciation
        }
    }

    private func submit(exercise: Exercise, correct isCorrect: Bool) {
        guard case .answering = phase else { return }
        phase = .feedback(correct: isCorrect, detail: nil)
        answered += 1
        if isCorrect { correct += 1 }
        model.record(AnswerOutcome(
            key: exercise.key, correct: isCorrect,
            exerciseType: exercise.kind.rawValue, answeredAt: Date()
        ))
        Haptics.answer(correct: isCorrect)
    }

    private func advance() {
        index += 1
        phase = .answering
        if index >= steps.count {
            Achievements.evaluate(model: model, direction: direction, session: nil)
        } else {
            speakCurrent()
        }
    }

    private func speakCurrent() {
        guard index < steps.count, let line = npcLine(steps[index]) else { return }
        speaker.speak(AudioCue(text: line.spokenText, language: direction.target), slow: false)
    }
}

/// The other side of the conversation.
private struct NPCBubble: View {
    let text: String
    let subtitle: String?
    let onSpeak: (Bool) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: "person.fill")
                    .font(.system(size: 15))
                    .foregroundStyle(Theme.textTertiary)
                    .padding(.top, 3)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 4) {
                    Text(text)
                        .font(.system(size: 20, weight: .semibold, design: .rounded))
                        .foregroundStyle(Theme.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                    if let subtitle, !subtitle.isEmpty {
                        Text(subtitle)
                            .font(.footnote)
                            .foregroundStyle(Theme.textSecondary)
                    }
                }
            }
            HStack(spacing: 10) {
                Button { onSpeak(false) } label: {
                    Image(systemName: "speaker.wave.2.fill")
                }
                .buttonStyle(SecondaryButtonStyle())
                Button { onSpeak(true) } label: {
                    Image(systemName: "tortoise.fill")
                }
                .buttonStyle(SecondaryButtonStyle())
            }
        }
        .cardSurface()
    }
}
