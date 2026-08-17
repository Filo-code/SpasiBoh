import SwiftUI
import SpasiBohCore

/// Runs a session end to end: question, answer, feedback, recap.
struct SessionView: View {
    let mode: TrainingMode

    @Environment(ProgressModel.self) private var model
    @Environment(AppSettings.self) private var settings
    @Environment(\.dismiss) private var dismiss

    @State private var runner: SessionRunner?
    @State private var speaker: any Speaking = SpeechSynthesizer()
    @State private var listener: any Listening = SpeechRecognizerService()

    private var direction: Direction { settings.direction ?? .itToRu }
    private var ui: Language { direction.native }

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()

            if let runner {
                if runner.isEmpty {
                    emptyState
                } else if case .finished = runner.phase {
                    RecapView(runner: runner, ui: ui) { dismiss() }
                        .transition(.opacity)
                } else {
                    running(runner)
                }
            } else {
                ProgressView().tint(Theme.accent)
            }
        }
        .task { await start() }
        .onDisappear { speaker.stop(); listener.stop() }
    }

    // MARK: - Building

    private func start() async {
        guard runner == nil else { return }
        // Ask for the microphone only when a session that can use it starts —
        // asking at launch, before the learner has seen why, gets refused.
        var speechOK = false
        let speechDisabledForTests = ProcessInfo.processInfo.environment["SPASIBOH_UITEST_NO_SPEECH"] == "1"
        if !speechDisabledForTests, mode == .pronunciation || mode == .daily {
            let status = listener.authorization == .notDetermined
                ? await listener.requestAuthorization()
                : listener.authorization
            speechOK = status == .granted
        }
        let builder = SessionBuilder(content: model.content, speechAvailable: speechOK)
        let session = builder.build(mode: mode, direction: direction, progress: model.progress)
        runner = SessionRunner(session: session)
        if let first = session.exercises.first, first.kind.isAudioPrompt {
            speaker.speak(first.audio ?? AudioCue(text: first.promptText, language: direction.target), slow: false)
        }
    }

    // MARK: - Screens

    private var emptyState: some View {
        VStack(spacing: 20) {
            Image(systemName: "checkmark.seal")
                .font(.system(size: 48))
                .foregroundStyle(Theme.correct)
            Text(mode == .mistakes ? S.nothingToReview(ui) : S.noExercises(ui))
                .font(.headline)
                .foregroundStyle(Theme.textSecondary)
                .multilineTextAlignment(.center)
            Button(S.backToHome(ui)) { dismiss() }
                .buttonStyle(PrimaryButtonStyle())
        }
        .padding(28)
    }

    @ViewBuilder
    private func running(_ runner: SessionRunner) -> some View {
        VStack(spacing: 0) {
            header(runner)

            if let exercise = runner.current {
                ScrollView {
                    ExerciseCard(
                        exercise: exercise,
                        ui: ui,
                        phase: runner.phase,
                        speaker: speaker,
                        listener: listener,
                        onAnswer: { correct, detail in answer(correct, detail: detail, runner: runner) }
                    )
                    .id(exercise.id + "\(runner.index)")
                    .padding(.horizontal, 18)
                    .padding(.top, 8)
                }

                feedbackBar(runner, exercise: exercise)
            }
        }
    }

    private func header(_ runner: SessionRunner) -> some View {
        HStack(spacing: 14) {
            Button {
                dismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Theme.textSecondary)
                    .frame(width: Theme.tapTarget, height: Theme.tapTarget)
            }
            .accessibilityLabel(S.close(ui))

            ProgressView(value: runner.progress)
                .tint(Theme.accent)
                .accessibilityLabel(S.stepOf.with("\(runner.index + 1)/\(runner.queue.count)")(ui))

            Text("\(runner.correct)/\(runner.answered)")
                .font(.footnote.weight(.semibold).monospacedDigit())
                .foregroundStyle(Theme.textSecondary)
                .padding(.trailing, 14)
        }
        .padding(.trailing, 4)
    }

    @ViewBuilder
    private func feedbackBar(_ runner: SessionRunner, exercise: Exercise) -> some View {
        switch runner.phase {
        case .answering:
            Button(S.skip(ui)) {
                if let outcome = runner.skip() { model.record(outcome) }
            }
            .font(.footnote.weight(.medium))
            .foregroundStyle(Theme.textTertiary)
            .frame(minHeight: Theme.tapTarget)
            .padding(.bottom, 4)

        case .feedback(let correct, let detail):
            FeedbackBar(
                correct: correct,
                detail: detail,
                expected: correct ? nil : expectedAnswer(exercise),
                note: exercise.note?(ui),
                ui: ui
            ) {
                runner.advance()
                if let next = runner.current, next.kind.isAudioPrompt {
                    speaker.speak(next.audio ?? AudioCue(text: next.promptText, language: direction.target), slow: false)
                }
                if case .finished = runner.phase { finish(runner) }
            }

        case .finished:
            EmptyView()
        }
    }

    private func expectedAnswer(_ exercise: Exercise) -> String? {
        if let index = exercise.correctOption, exercise.options.indices.contains(index) {
            return exercise.options[index].text
        }
        return exercise.expected
    }

    // MARK: - Actions

    private func answer(_ correct: Bool, detail: String?, runner: SessionRunner) {
        guard let outcome = runner.submit(correct: correct, detail: detail) else { return }
        let xp = model.record(outcome)
        runner.addXP(xp)
        Haptics.answer(correct: correct)
    }

    private func finish(_ runner: SessionRunner) {
        guard runner.answered > 0 else { return }
        model.finishSession(runner.record())
        Achievements.evaluate(model: model, direction: direction, session: runner)
    }
}

// MARK: - Feedback

private struct FeedbackBar: View {
    let correct: Bool
    let detail: String?
    let expected: String?
    let note: String?
    let ui: Language
    let onNext: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                Image(systemName: correct ? "checkmark.circle.fill" : "arrow.uturn.left.circle.fill")
                    .font(.system(size: 22, weight: .bold))
                Text(correct ? S.correct(ui) : S.wrong(ui))
                    .font(.headline)
                Spacer()
            }
            .foregroundStyle(correct ? Theme.correct : Theme.wrong)

            if !correct, let expected {
                Text("\(S.correctAnswerWas(ui)): \(expected)")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.textPrimary)
            }
            if let detail, !detail.isEmpty {
                Text("\(S.iHeard(ui)): \(detail)")
                    .font(.footnote)
                    .foregroundStyle(Theme.textSecondary)
            }
            if let note, !note.isEmpty {
                Text(note)
                    .font(.footnote)
                    .foregroundStyle(Theme.textSecondary)
            }
            if !correct {
                Text(S.willComeBack(ui))
                    .font(.caption)
                    .foregroundStyle(Theme.textTertiary)
            }

            Button(S.next(ui), action: onNext)
                .buttonStyle(PrimaryButtonStyle(tint: correct ? Theme.correct : Theme.wrong))
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: Theme.cornerRadius))
        .padding(.horizontal, 14)
        .padding(.bottom, 10)
        .transition(.move(edge: .bottom).combined(with: .opacity))
    }
}

// MARK: - Recap

struct RecapView: View {
    let runner: SessionRunner
    let ui: Language
    let onDone: () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 22) {
                Image(systemName: "checkmark.seal.fill")
                    .font(.system(size: 56))
                    .foregroundStyle(Theme.accent)
                    .padding(.top, 40)

                Text(S.sessionDone(ui))
                    .font(.system(size: 26, weight: .heavy, design: .rounded))
                    .foregroundStyle(Theme.textPrimary)

                HStack(spacing: 10) {
                    RecapTile(value: "\(runner.answered)", label: S.answered(ui))
                    RecapTile(value: "\(Int(runner.accuracy * 100))%", label: S.accuracy(ui))
                    RecapTile(value: "+\(runner.xpEarned)", label: S.xpEarned(ui), tint: Theme.accent)
                }

                if !runner.missedItems.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("\(S.toReview(ui)): \(runner.missedItems.count)")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.textPrimary)
                        Text(S.willComeBack(ui))
                            .font(.footnote)
                            .foregroundStyle(Theme.textSecondary)
                    }
                    .cardSurface()
                }

                Button(S.backToHome(ui), action: onDone)
                    .buttonStyle(PrimaryButtonStyle())
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 40)
        }
    }
}

private struct RecapTile: View {
    let value: String
    let label: String
    var tint: Color = Theme.textPrimary

    var body: some View {
        VStack(spacing: 6) {
            Text(value)
                .font(.system(size: 24, weight: .bold, design: .rounded))
                .foregroundStyle(tint)
                .minimumScaleFactor(0.6)
                .lineLimit(1)
            Text(label)
                .font(.caption2)
                .foregroundStyle(Theme.textSecondary)
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 16)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(label): \(value)")
    }
}
