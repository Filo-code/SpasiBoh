import SwiftUI
import SpasiBohCore

@main
struct SpasiBohApp: App {
    @State private var settings = AppSettings.load()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(settings)
                // The UI language follows the learning direction (§12): an
                // Italian speaker learning Russian gets an Italian interface.
                .environment(\.locale, Locale(identifier: settings.direction?.native.rawValue ?? "it"))
                .preferredColorScheme(.dark)
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

    var body: some View {
        if settings.direction == nil {
            OnboardingView()
        } else {
            HomeView()
        }
    }
}
