import Foundation
import Capacitor

// Les fichiers restent dans Documents, accessible depuis l'app Fichiers d'iOS.
@objc(FileSaverPlugin)
public final class FileSaverPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FileSaverPlugin"
    public let jsName = "FileSaver"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "save", returnType: CAPPluginReturnPromise)
    ]

    @objc func save(_ call: CAPPluginCall) {
        guard let base64 = call.getString("data"),
              let data = Data(base64Encoded: base64) else {
            call.reject("Le contenu du fichier est invalide.")
            return
        }
        let requested = call.getString("name") ?? "fichier.txt"
        let component = (requested as NSString).lastPathComponent
        let clean = component.components(separatedBy: .controlCharacters).joined()
        let name = clean.isEmpty || clean == "." || clean == ".." ? "fichier.txt" : clean
        do {
            let manager = FileManager.default
            let documents = try manager.url(for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
            var target = documents.appendingPathComponent(name, isDirectory: false)
            let stem = (name as NSString).deletingPathExtension
            let ext = (name as NSString).pathExtension
            var suffix = 1
            while manager.fileExists(atPath: target.path) {
                let candidate = "\(stem)-\(suffix)" + (ext.isEmpty ? "" : ".\(ext)")
                target = documents.appendingPathComponent(candidate, isDirectory: false)
                suffix += 1
            }
            try data.write(to: target, options: .atomic)
            call.resolve([
                "path": "Fichiers/Sur mon iPhone/FranceStudent Chat/" + target.lastPathComponent,
                "uri": target.absoluteString
            ])
        } catch {
            call.reject("Impossible d’enregistrer le fichier : " + error.localizedDescription)
        }
    }
}
