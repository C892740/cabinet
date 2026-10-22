import SwiftUI

struct RootView: View {
    var body: some View {
        TabView {
            WebTab()
                .tabItem {
                    Label("Library", systemImage: "gamecontroller")
                }
            NavigationView {
                PairingView()
            }
            .navigationViewStyle(.stack)
            .tabItem {
                Label("Link TV", systemImage: "tv")
            }
            NavigationView {
                RomScannerView()
            }
            .navigationViewStyle(.stack)
            .tabItem {
                Label("ROMs", systemImage: "folder")
            }
        }
    }
}
