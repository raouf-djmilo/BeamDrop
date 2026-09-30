/**
 * Generates an Apple iOS Shortcut (.shortcut) XML/bplist tailored to the current origin
 * Allowing 1-click install into iOS Shortcuts & Share Sheet
 */

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
				<string>BeamDrop to PC - Instant P2P File &amp; Media Transfer from iOS to PC Extension/Web. Point camera at PC QR Receive Address to transfer!</string>
			</dict>
		</dict>
		<dict>
			<key>WFWorkflowActionIdentifier</key>
			<string>is.workflow.actions.url</string>
			<key>WFWorkflowActionParameters</key>
			<dict>
				<key>WFURLActionURL</key>
				<string>${targetUrl.replace(/&/g, '&amp;')}</string>
			</dict>
		</dict>
		<dict>
			<key>WFWorkflowActionIdentifier</key>
			<string>is.workflow.actions.openurl</string>
			<key>WFWorkflowActionParameters</key>
			<dict>
				<key>WFInput</key>
				<dict>
					<key>Value</key>
					<dict>
						<key>Type</key>
						<string>ExtensionInput</string>
					</dict>
					<key>WFSerializationType</key>
					<string>WFTextTokenAttachment</string>
				</dict>
			</dict>
		</dict>
	</array>
	<key>WFWorkflowClientVersion</key>
	<string>2104.0.3</string>
	<key>WFWorkflowHasOutputFallback</key>
	<false/>
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
		<string>NCWidget</string>
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
