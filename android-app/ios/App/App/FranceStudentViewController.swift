import Capacitor

@objc(FranceStudentViewController)
final class FranceStudentViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(FileSaverPlugin())
    }
}
