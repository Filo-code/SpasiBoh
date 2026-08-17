import SwiftUI
import SpasiBohCore

/// Renders one exercise and collects the answer.
///
/// One view for every format rather than a view per kind: they share the same
/// prompt block, the same answer-locking rules and the same accessibility
/// treatment, and splitting them would mean maintaining that four times.
struct ExerciseCard: View {
    let exercise: Exercise
    let ui: Language
    let phase: SessionRunner.Phase
    let speaker: any Speaking
    let listener: any Listening
    /// `(correct, detail)` — detail carries what the recogniser heard.
    let onAnswer: (Bool, String?) -> Void

    @State private var chosen: Int?
    @State private var assembled: [Int] = []
    @State private var isRecording = false
    @State private var speechError: String?

    private var locked: Bool {
        if case .answering = phase { return false }
        return true
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text(instruction(ui))
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.textSecondary)

            promptBlock

            switch exercise.kind {
            case .spelling, .sentenceBuild:
                assemblyInput
            case .pronunciation:
                speechInput
            default:
                choiceInput
            }
        }
        .padding(.bottom, 20)
        .animation(.easeInOut(duration: 0.18), value: chosen)
        .animation(.easeInOut(duration: 0.18), value: assembled)
    }

    private func instruction(_ language: Language) -> String {
        switch exercise.kind {
        case .recognition: S.chooseMeaning(language)
        case .recall: S.chooseTranslation(language)
        case .listening: S.listenAndChoose(language)
        case .pronunciation: S.sayItAloud(language)
        case .spelling: S.spellIt(language)
        case .sentenceBuild: S.buildSentence(language)
        case .sentenceGap: S.fillTheGap(language)
        case .sentenceReply: S.chooseReply(language)
        case .letterSound, .patternSound: S.whichSound(language)
        case .letterRecognize: S.whichLetter(language)
        case .minimalPair: S.whichWord(language)
        }
    }

    // MARK: - Prompt

    @ViewBuilder
    private var promptBlock: some View {
        VStack(spacing: 12) {
            if let line = exercise.speakerLine {
                Text(line)
                    .font(.body)
                    .foregroundStyle(Theme.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            if exercise.kind.isAudioPrompt {
                // Audio-only: no text, or the answer is written on the screen.
                Image(systemName: "waveform")
                    .font(.system(size: 40, weight: .light))
                    .foregroundStyle(Theme.accent)
                    .padding(.vertical, 8)
                    .accessibilityHidden(true)
            } else if !exercise.promptText.isEmpty {
                TargetText(text: exercise.promptText, size: exercise.promptText.count > 22 ? 28 : 40)
            }

            // The pronunciation hint stays visible after answering too — it is
            // the thing worth remembering, not a crutch to take away.
            if let subtitle = exercise.promptSubtitle, !subtitle.isEmpty {
                Text(subtitle)
                    .font(.callout)
                    .foregroundStyle(Theme.textSecondary)
                    .multilineTextAlignment(.center)
            }

            if exercise.audio != nil {
                audioControls
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 22)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: Theme.cornerRadius))
    }

    private var audioControls: some View {
        HStack(spacing: 12) {
            Button {
                if let audio = exercise.audio { speaker.speak(audio, slow: false) }
            } label: {
                Label(S.listen(ui), systemImage: "speaker.wave.2.fill")
                    .font(.subheadline.weight(.semibold))
            }
            .buttonStyle(SecondaryButtonStyle())

            Button {
                if let audio = exercise.audio { speaker.speak(audio, slow: true) }
            } label: {
                Label(S.listenSlowly(ui), systemImage: "tortoise.fill")
                    .font(.subheadline.weight(.semibold))
            }
            .buttonStyle(SecondaryButtonStyle())
        }
        .frame(minHeight: Theme.tapTarget)
    }

    // MARK: - Multiple choice

    private var choiceInput: some View {
        VStack(spacing: 10) {
            ForEach(exercise.options) { option in
                Button {
                    guard !locked else { return }
                    chosen = option.id
                    onAnswer(exercise.isCorrect(option: option.id), nil)
                } label: {
                    HStack {
                        Text(option.text)
                            .font(.system(size: 19, weight: .semibold, design: .rounded))
                            .foregroundStyle(Theme.textPrimary)
                            .multilineTextAlignment(.leading)
                            .minimumScaleFactor(0.6)
                            .lineLimit(3)
                        Spacer(minLength: 8)
                    }
                    .padding(.horizontal, 18)
                    .padding(.vertical, 16)
                    .frame(maxWidth: .infinity, minHeight: Theme.tapTarget, alignment: .leading)
                    .background(optionBackground(option.id), in: RoundedRectangle(cornerRadius: 14))
                    .overlay(
                        RoundedRectangle(cornerRadius: 14)
                            .stroke(optionBorder(option.id), lineWidth: 2)
                    )
                }
                .buttonStyle(.plain)
                .disabled(locked)
                .accessibilityAddTraits(chosen == option.id ? [.isSelected] : [])
            }
        }
    }

    /// Once answered, the right answer is always shown — including when the
    /// learner got it right, so the correct form is the last thing seen.
    private func optionBackground(_ id: Int) -> Color {
        guard locked else { return Theme.surfaceRaised }
        if exercise.isCorrect(option: id) { return Theme.correct.opacity(0.22) }
        if chosen == id { return Theme.wrong.opacity(0.22) }
        return Theme.surfaceRaised
    }

    private func optionBorder(_ id: Int) -> Color {
        guard locked else { return .clear }
        if exercise.isCorrect(option: id) { return Theme.correct }
        if chosen == id { return Theme.wrong }
        return .clear
    }

    // MARK: - Tile / block assembly

    private var assembledText: String {
        assembled.map { exercise.blocks[$0] }
            .joined(separator: exercise.kind == .spelling ? "" : " ")
    }

    private var assemblyInput: some View {
        VStack(spacing: 16) {
            // The answer line. Fixed minimum height so the layout does not jump
            // as blocks are added, which makes tapping the next one a moving
            // target.
            Text(assembledText.isEmpty ? " " : assembledText)
                .font(.system(size: 24, weight: .bold, design: .rounded))
                .foregroundStyle(Theme.textPrimary)
                .frame(maxWidth: .infinity, minHeight: 56, alignment: .center)
                .padding(.horizontal, 12)
                .background(Theme.surfaceRaised, in: RoundedRectangle(cornerRadius: 14))
                .overlay(alignment: .bottom) {
                    Rectangle().fill(Theme.accent.opacity(0.5)).frame(height: 2)
                }
                .accessibilityLabel(assembledText)

            FlowLayout(spacing: 8) {
                ForEach(Array(exercise.blocks.enumerated()), id: \.offset) { index, block in
                    Button {
                        guard !locked else { return }
                        if let position = assembled.firstIndex(of: index) {
                            assembled.remove(at: position)
                        } else {
                            assembled.append(index)
                        }
                    } label: {
                        Text(block)
                            .font(.system(size: 19, weight: .semibold, design: .rounded))
                            .foregroundStyle(assembled.contains(index) ? Theme.textTertiary : Theme.textPrimary)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 12)
                            .frame(minHeight: Theme.tapTarget)
                            .background(
                                assembled.contains(index) ? Theme.surface : Theme.surfaceRaised,
                                in: RoundedRectangle(cornerRadius: 12)
                            )
                    }
                    .buttonStyle(.plain)
                    .disabled(locked)
                }
            }

            HStack(spacing: 12) {
                Button(S.clear(ui)) { assembled.removeAll() }
                    .buttonStyle(SecondaryButtonStyle())
                    .disabled(locked || assembled.isEmpty)

                Button(S.check(ui)) {
                    onAnswer(exercise.isCorrect(text: assembledText), nil)
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(locked || assembled.isEmpty)
            }
        }
    }

    // MARK: - Speech

    private var speechInput: some View {
        VStack(spacing: 14) {
            Button {
                Task { await recordAnswer() }
            } label: {
                VStack(spacing: 8) {
                    Image(systemName: isRecording ? "waveform.circle.fill" : "mic.circle.fill")
                        .font(.system(size: 54))
                        .foregroundStyle(isRecording ? Theme.wrong : Theme.accent)
                        .symbolEffect(.pulse, isActive: isRecording)
                    Text(isRecording ? S.listening(ui) : S.tapToSpeak(ui))
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.textSecondary)
                }
                .frame(maxWidth: .infinity, minHeight: 120)
            }
            .buttonStyle(.plain)
            .disabled(locked)

            if let speechError {
                Text(speechError)
                    .font(.footnote)
                    .foregroundStyle(Theme.textTertiary)
                    .multilineTextAlignment(.center)
            }
        }
    }

    private func recordAnswer() async {
        guard !locked else { return }
        if isRecording {
            listener.stop()
            return
        }
        speechError = nil
        isRecording = true
        defer { isRecording = false }
        do {
            let language = exercise.expectedLanguage ?? .russian
            let transcripts = try await listener.record(language: language)
            let match = exercise.matchSpeech(transcripts)
            // Report honestly: the score is a string-similarity match on what
            // the recogniser heard, not phoneme analysis. Showing the
            // transcript is what makes that legible rather than magic (§37).
            onAnswer(match.matched, match.bestTranscript.isEmpty ? nil : match.bestTranscript)
        } catch {
            speechError = S.speechUnavailable(ui)
        }
    }
}

// MARK: - Layout

/// Wrapping row layout for answer tiles.
///
/// `LazyVGrid` cannot do this: tiles are all different widths (a Cyrillic
/// letter and a five-letter Italian word are not the same size), and a fixed
/// column count would leave either huge gaps or truncated words.
struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, rowHeight: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > width, x > 0 {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
        return CGSize(width: proposal.width ?? x, height: y + rowHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, rowHeight: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > bounds.maxX, x > bounds.minX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            subview.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}
