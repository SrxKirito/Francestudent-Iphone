import Foundation
import Capacitor
import UIKit
import PhotosUI
import UniformTypeIdentifiers

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

// Sélecteurs explicites : ne passent pas par la feuille de choix du WebView.
@objc(AttachmentPickerPlugin)
public final class AttachmentPickerPlugin: CAPPlugin, CAPBridgedPlugin, PHPickerViewControllerDelegate, UIDocumentPickerDelegate, UIAdaptivePresentationControllerDelegate {
    public let identifier = "AttachmentPickerPlugin"
    public let jsName = "AttachmentPicker"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "pickPhotos", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pickFiles", returnType: CAPPluginReturnPromise)
    ]
    private var pending: CAPPluginCall?
    private let limit = 50 * 1024 * 1024

    private func present(_ call: CAPPluginCall, photos: Bool) {
        DispatchQueue.main.async {
            guard self.pending == nil, let host = self.bridge?.viewController,
                  host.presentedViewController == nil else {
                call.reject("Une sélection est déjà ouverte.")
                return
            }
            self.pending = call
            let controller: UIViewController
            if photos {
                var config = PHPickerConfiguration()
                config.filter = .images
                config.selectionLimit = 10
                let picker = PHPickerViewController(configuration: config)
                picker.delegate = self
                controller = picker
            } else {
                let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.item], asCopy: true)
                picker.allowsMultipleSelection = true
                picker.delegate = self
                controller = picker
            }
            host.present(controller, animated: true)
            controller.presentationController?.delegate = self
        }
    }

    @objc func pickPhotos(_ call: CAPPluginCall) { present(call, photos: true) }
    @objc func pickFiles(_ call: CAPPluginCall) { present(call, photos: false) }

    private func finish(_ files: [[String: Any]], error: String? = nil) {
        DispatchQueue.main.async {
            guard let call = self.pending else { return }
            self.pending = nil
            if let error = error { call.reject(error) }
            else { call.resolve(["files": files]) }
        }
    }

    public func presentationControllerDidDismiss(_ presentationController: UIPresentationController) { finish([]) }
    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) { finish([]) }

    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                var files: [[String: Any]] = []
                var total = 0
                for url in urls {
                    let accessed = url.startAccessingSecurityScopedResource()
                    defer { if accessed { url.stopAccessingSecurityScopedResource() } }
                    let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
                    guard size <= self.limit - total else { throw PickerError.tooLarge }
                    let data = try Data(contentsOf: url, options: .mappedIfSafe)
                    total += data.count
                    guard total <= self.limit else { throw PickerError.tooLarge }
                    let mime = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
                    files.append(["name": url.lastPathComponent, "mime": mime, "data": data.base64EncodedString()])
                }
                self.finish(files)
            } catch { self.finish([], error: error.localizedDescription) }
        }
    }

    public func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        picker.dismiss(animated: true) {
            self.loadPhotos(results, index: 0, files: [], total: 0)
        }
    }

    private func loadPhotos(_ results: [PHPickerResult], index: Int, files: [[String: Any]], total: Int) {
        guard index < results.count else { finish(files); return }
        let provider = results[index].itemProvider
        provider.loadObject(ofClass: UIImage.self) { object, error in
            guard let image = object as? UIImage, error == nil else {
                self.finish([], error: "Impossible de lire cette photo."); return
            }
            let scale = min(1, 2048 / max(image.size.width, image.size.height))
            let size = CGSize(width: max(1, image.size.width * scale), height: max(1, image.size.height * scale))
            let format = UIGraphicsImageRendererFormat()
            format.scale = 1
            let resized = UIGraphicsImageRenderer(size: size, format: format).image { context in
                UIColor.white.setFill(); context.fill(CGRect(origin: .zero, size: size))
                image.draw(in: CGRect(origin: .zero, size: size))
            }
            guard let data = resized.jpegData(compressionQuality: 0.9), data.count <= self.limit - total else {
                self.finish([], error: "La sélection dépasse 50 Mo."); return
            }
            var next = files
            next.append(["name": "photo-\(index + 1).jpg", "mime": "image/jpeg", "data": data.base64EncodedString()])
            self.loadPhotos(results, index: index + 1, files: next, total: total + data.count)
        }
    }

    private enum PickerError: LocalizedError {
        case tooLarge
        var errorDescription: String? { "La sélection dépasse 50 Mo." }
    }
}
