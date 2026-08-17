import SwiftUI
import UniformTypeIdentifiers
import SpasiBohCore

/// Direction switching and data control (§105).
struct SettingsView: View {
    @Environment(AppSettings.self) private var settings
    @Environment(ProgressModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    @State private var showingReset = false
    @State private var showingImporter = false
    @State private var showingExporter = false
    @State private var pending: ProgressArchive.Envelope?
    @State private var importError: String?

    private var direction: Direction { settings.direction ?? .itToRu }
    private var ui: Language { direction.native }

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        directionSection
                        dataSection
                    }
                    .padding(18)
                }
            }
            .navigationTitle(S.settings(ui))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button(S.close(ui)) { dismiss() }
                }
            }
            // Destructive and irreversible, so it asks — and says what it will
            // destroy rather than just "are you sure?".
            .alert(S.resetProgress(ui), isPresented: $showingReset) {
                Button(S.cancel(ui), role: .cancel) {}
                Button(S.resetConfirm(ui), role: .destructive) { model.reset() }
            } message: {
                Text(S.resetWarning(ui))
            }
            .alert(S.importProgress(ui), isPresented: .constant(pending != nil)) {
                Button(S.cancel(ui), role: .cancel) { pending = nil }
                Button(S.importConfirm(ui), role: .destructive) {
                    if let pending { model.replaceAll(with: pending.progress) }
                    pending = nil
                }
            } message: {
                if let pending {
                    // Say what is about to replace their data, not just "are
                    // you sure?" — a blind confirmation is not consent.
                    let summary = ProgressArchive.summary(of: pending)
                    Text("""
                    \(summary.exportedAt.formatted(date: .abbreviated, time: .shortened)) · \
                    \(summary.trackedItems) · \(summary.xp) XP

                    \(S.importWarning(ui))
                    """)
                }
            }
            .alert(S.importFailed(ui), isPresented: .constant(importError != nil)) {
                Button(S.close(ui)) { importError = nil }
            } message: {
                Text(importError ?? "")
            }
            .fileImporter(isPresented: $showingImporter, allowedContentTypes: [.json]) { result in
                handleImport(result)
            }
            .fileExporter(
                isPresented: $showingExporter,
                document: ProgressDocument(progress: model.progress),
                contentType: .json,
                defaultFilename: "spasiboh-progress"
            ) { _ in }
        }
    }

    private var directionSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(S.learningDirection(ui))
                .font(.headline)
                .foregroundStyle(Theme.textPrimary)
            ForEach(Direction.allCases, id: \.self) { option in
                Button {
                    // Switching direction never touches progress: the two
                    // directions keep separate books, so coming back finds
                    // everything where it was left.
                    settings.direction = option
                } label: {
                    HStack {
                        Text("\(option.native.flag) \(option.native.endonym) → \(option.target.flag) \(option.target.endonym)")
                            .font(.body.weight(.medium))
                            .foregroundStyle(Theme.textPrimary)
                        Spacer()
                        if option == direction {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundStyle(Theme.accent)
                        }
                    }
                    .cardSurface(padding: 14)
                    .frame(minHeight: Theme.tapTarget)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var dataSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Button {
                showingExporter = true
            } label: {
                Label(S.exportProgress(ui), systemImage: "square.and.arrow.up")
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .cardSurface(padding: 14)
            }
            .buttonStyle(.plain)

            Button {
                showingImporter = true
            } label: {
                Label(S.importProgress(ui), systemImage: "square.and.arrow.down")
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .cardSurface(padding: 14)
            }
            .buttonStyle(.plain)

            Button {
                showingReset = true
            } label: {
                Label(S.resetProgress(ui), systemImage: "trash")
                    .foregroundStyle(Theme.wrong)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .cardSurface(padding: 14)
            }
            .buttonStyle(.plain)
        }
        .tint(Theme.textPrimary)
    }

    private func handleImport(_ result: Result<URL, Error>) {
        do {
            let url = try result.get()
            // Files picked from outside the sandbox need explicit access.
            let scoped = url.startAccessingSecurityScopedResource()
            defer { if scoped { url.stopAccessingSecurityScopedResource() } }
            // Parsed, shown, and only then applied — never silently.
            pending = try ProgressArchive.parse(try Data(contentsOf: url))
        } catch let error as ProgressArchive.ImportError {
            importError = error.description
        } catch {
            importError = String(describing: error)
        }
    }
}

/// Wrapper that lets `fileExporter` write the archive.
struct ProgressDocument: FileDocument {
    static let readableContentTypes = [UTType.json]

    let data: Data

    init(progress: LearnerProgress) {
        data = (try? ProgressArchive.export(progress)) ?? Data("{}".utf8)
    }

    init(configuration: ReadConfiguration) throws {
        data = configuration.file.regularFileContents ?? Data()
    }

    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
        FileWrapper(regularFileWithContents: data)
    }
}
