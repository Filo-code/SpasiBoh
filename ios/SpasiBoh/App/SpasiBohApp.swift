import SwiftUI
import SpasiBohCore

@main
struct SpasiBohApp: App {
    @State private var settings = AppSettings.load()
    @State private var model = ProgressModel.live()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(settings)
                .environment(model)
                .preferredColorScheme(.dark)
                .tint(Theme.accent)
        }
    }
}

/// Local settings. No account, no cloud, no login (§12, §95).
@Observable
final class AppSettings {
    /// nil until the learner has chosen on the onboarding screen.
    var direction: Direction? {
        didSet { save() }
    }

    private static let directionKey = "spasiboh.direction"

    private init(direction: Direction?) {
        self.direction = direction
    }

    static func load() -> AppSettings {
        let raw = UserDefaults.standard.string(forKey: directionKey)
        return AppSettings(direction: raw.flatMap(Direction.init(rawValue:)))
    }

    private func save() {
        let defaults = UserDefaults.standard
        if let direction {
            defaults.set(direction.rawValue, forKey: Self.directionKey)
        } else {
            defaults.removeObject(forKey: Self.directionKey)
        }
    }
}

struct RootView: View {
    @Environment(AppSettings.self) private var settings
    @Environment(ProgressModel.self) private var model

    var body: some View {
        if model.content.concepts.isEmpty {
            // Content is the app. Showing an empty but functional-looking
            // interface would be worse than saying plainly that it is broken.
            ContentUnavailableView(
                S.contentFailed(settings.direction?.native ?? .italian),
                systemImage: "exclamationmark.triangle",
                description: Text(model.loadFailure ?? "")
            )
        } else if settings.direction == nil {
            OnboardingView()
        } else {
            HomeView()
        }
    }
}
