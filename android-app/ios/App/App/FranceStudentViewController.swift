import Capacitor

@objc(FranceStudentViewController)
final class FranceStudentViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(FileSaverPlugin())
        bridge?.registerPluginInstance(AttachmentPickerPlugin())
        bridge?.registerPluginInstance(ChatStreamPlugin())
        webView?.scrollView.bounces = false
        webView?.scrollView.contentInsetAdjustmentBehavior = .never
    }
}
