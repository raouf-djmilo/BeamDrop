/**
 * Official Apple iOS iCloud Shortcut link
 * Cryptographically signed and hosted by Apple's iCloud servers.
 * Opens directly in the native Apple Shortcuts installation sheet on iOS 15, 16, 17, 18+.
 */
export const OFFICIAL_IOS_SHORTCUT_ICLOUD_URL = 'https://www.icloud.com/shortcuts/0b10ce1117eb49528d916c7557f472f2';

export function openOfficialIosShortcut() {
  if (typeof window !== 'undefined') {
    window.open(OFFICIAL_IOS_SHORTCUT_ICLOUD_URL, '_blank');
  }
}

export function generateIosShortcutBlob(customOrigin?: string): Blob {
  const origin = customOrigin || (typeof window !== 'undefined' ? window.location.origin : 'https://beam-drop-mu.vercel.app');
  const targetUrl = `${origin}/?mode=scan&from=ios_shortcut`;

  const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>WFWorkflowActions</key>
	<array>
		<dict>
			<key>WFWorkflowActionIdentifier</key>
			<string>is.workflow.actions.comment</string>
			<key>WFWorkflowActionParameters</key>
			<dict>
				<key>WFCommentActionText</key>
				<string>BeamDrop to PC - Instant P2P File &amp; Media Transfer from iOS to PC Extension/Web. Point camera at PC QR Receive Address to transfer directly without opening browser!</string>
			</dict>
		</dict>
		<dict>
			<key>WFWorkflowActionIdentifier</key>
			<string>is.workflow.actions.scanbarcode</string>
			<key>WFWorkflowActionParameters</key>
			<dict>
				<key>UUID</key>
				<string>BD-SCAN-BARCODE-UUID</string>
			</dict>
		</dict>
		<dict>
			<key>WFWorkflowActionIdentifier</key>
			<string>is.workflow.actions.downloadurl</string>
			<key>WFWorkflowActionParameters</key>
			<dict>
				<key>WFHTTPBodyType</key>
				<string>File</string>
				<key>WFHTTPMethod</key>
				<string>POST</string>
				<key>WFRequestVariable</key>
				<dict>
					<key>Value</key>
					<dict>
						<key>Type</key>
						<string>ExtensionInput</string>
					</dict>
					<key>WFSerializationType</key>
					<string>WFTextTokenAttachment</string>
				</dict>
				<key>WFURL</key>
				<dict>
					<key>Value</key>
					<dict>
						<key>OutputName</key>
						<string>QR/Barcode</string>
						<key>OutputUUID</key>
						<string>BD-SCAN-BARCODE-UUID</string>
						<key>Type</key>
						<string>ActionOutput</string>
					</dict>
					<key>WFSerializationType</key>
					<string>WFTextTokenAttachment</string>
				</dict>
			</dict>
		</dict>
		<dict>
			<key>WFWorkflowActionIdentifier</key>
			<string>is.workflow.actions.notification</string>
			<key>WFWorkflowActionParameters</key>
			<dict>
				<key>WFNotificationActionBody</key>
				<string>File beamed to PC Vault successfully!</string>
				<key>WFNotificationActionTitle</key>
				<string>BeamDrop</string>
			</dict>
		</dict>
	</array>
	<key>WFWorkflowClientVersion</key>
	<string>2104.0.3</string>
	<key>WFWorkflowHasShortcutInputVariables</key>
	<true/>
	<key>WFWorkflowIcon</key>
	<dict>
		<key>WFWorkflowIconGlyphNumber</key>
		<integer>59508</integer>
		<key>WFWorkflowIconStartColor</key>
		<integer>4282601983</integer>
	</dict>
	<key>WFWorkflowInputContentItemClasses</key>
	<array>
		<string>WFImageContentItem</string>
		<string>WFAVAssetContentItem</string>
		<string>WFGenericFileContentItem</string>
		<string>WFFolderContentItem</string>
		<string>WFPDFContentItem</string>
		<string>WFURLContentItem</string>
	</array>
	<key>WFWorkflowMinimumClientVersion</key>
	<integer>900</integer>
	<key>WFWorkflowMinimumClientVersionString</key>
	<string>900</string>
	<key>WFWorkflowTypes</key>
	<array>
		<string>ActionExtension</string>
	</array>
</dict>
</plist>`;

  return new Blob([plistContent], { type: 'application/x-apple-shortcut' });
}

export function downloadIosShortcut(customOrigin?: string) {
  const blob = generateIosShortcutBlob(customOrigin);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'BeamDrop to PC.shortcut';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
