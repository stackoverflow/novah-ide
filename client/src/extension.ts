
import * as path from 'path';
import { ExtensionContext, workspace } from 'vscode';
import * as vscode from 'vscode';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
	console.log('Starting Novah IDE...');
	registerNovahUri(context);

	const compilerPath: string | undefined = workspace.getConfiguration().get('novah.compilerPath');

	// Get the java home from the process environment.
	const { JAVA_HOME } = process.env;

	console.log(`Using java from JAVA_HOME: ${JAVA_HOME}`);
	// If java home is available continue.
	if (JAVA_HOME) {
		// Java execution path.
		let executable: string = path.join(JAVA_HOME, 'bin', 'java');

		checkFileExists(compilerPath, () => {
			let classPath = compilerPath;
			console.log(`Using class path: ${classPath}`);

			const args: string[] = ['-jar', classPath];

			// Set the server options 
			// -- java execution path
			// -- argument to be pass when executing the java command
			let serverOptions: ServerOptions = {
				run: {
					command: executable,
					args: [...args, "ide"],
					options: {}
				},
				debug: {
					command: executable,
					args: [...args, "ide", "--verbose"],
					options: {}
				}
			};

			let clientOptions: LanguageClientOptions = {
				documentSelector: [{ scheme: 'file', language: 'novah' }]
			};

			client = new LanguageClient('Novah', 'Novah Language Server', serverOptions, clientOptions);

			client.start()
		});
	} else {
		const msg = 'Could not find the JAVA_HOME environment variable. Make sure you have Java installed and JAVA_HOME set in your path.';
		vscode.window.showErrorMessage(msg, {modal: false});
	}
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}

function registerNovahUri(context: ExtensionContext) {
	const scheme = 'novah'
	const provider = new class implements vscode.TextDocumentContentProvider {

		onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
		onDidChange = this.onDidChangeEmitter.event;

		provideTextDocumentContent(uri: vscode.Uri): vscode.ProviderResult<string> {
			let newUri = uri.with({scheme: 'file'})
			return workspace.openTextDocument(newUri).then(document => document.getText())
		}
	}

	context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(scheme, provider))
}

function checkFileExists(fileName: string, onSuccess: () => void) {
	const file = vscode.Uri.file(fileName);
	workspace.fs.stat(file).then((_) => onSuccess(), (err) => {
		const msg = 'Could not find Novah compiler. Make sure you configure it properly in the settings (Compiler Path).';
		vscode.window.showErrorMessage(msg, {modal: false});
	});
}