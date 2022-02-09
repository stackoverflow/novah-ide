
import * as path from 'path';
import { ExtensionContext, workspace } from 'vscode';
import * as vscode from 'vscode';
import { existsSync } from 'fs';

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

	addTasks();
	addCommands();

	// Get the java home from the process environment.
	const { JAVA_HOME } = process.env;
	const { PATH } = process.env;
	const executable = JAVA_HOME ? path.join(JAVA_HOME, 'bin', 'java') : checkPathForJava(PATH);

	console.log(`Using java from: ${executable}`);
	// If java is available continue.
	if (executable) {
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
					args: [...args, "ide", "--verbose"],
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

			// client.onReady().then(() => {
			// 	client.onNotification('custom/setMain', (line : number) => {
			// 		vscode.window.showInformationMessage(`got setMain notification for line ${line}`);
			// 	})
			// });

			client.start()
		});
	} else {
		const msg = 'Could not find the JAVA_HOME environment variable or the java executable in path. Make sure you have Java installed.';
		vscode.window.showErrorMessage(msg, { modal: false });
	}
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}

function addTasks() {
	const type = "novah";
	vscode.tasks.registerTaskProvider(type, {
		provideTasks(token?: vscode.CancellationToken) {
			const build = new vscode.ShellExecution("novah deps build -a test");
			const run = new vscode.ShellExecution("novah run");
			const test = new vscode.ShellExecution("novah run -a test");
			const matcher = "novah error";
			return [
				new vscode.Task({ type: type, task: "build" }, vscode.TaskScope.Workspace,
					"Build", "novah-ide", build, matcher),
				new vscode.Task({ type: type, task: "run" }, vscode.TaskScope.Workspace,
					"Run", "novah-ide", run, matcher),
				new vscode.Task({ type: type, task: "test" }, vscode.TaskScope.Workspace,
					"test", "novah-ide", test, matcher),
			];
		},
		resolveTask(task: vscode.Task, token?: vscode.CancellationToken) {
			return task;
		}
	});
}

function addCommands() {
	vscode.commands.registerCommand('addTypeSignature', (line : number, col : number, type : string) => {
		vscode.window.activeTextEditor.edit((e) => {
			const text = line === 0 ? type + '\n' : '\n' + type + '\n'
			e.insert(new vscode.Position(line, col), text);
		})
	});
}

function registerNovahUri(context: ExtensionContext) {
	const scheme = 'novah'
	const provider = new class implements vscode.TextDocumentContentProvider {

		onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
		onDidChange = this.onDidChangeEmitter.event;

		provideTextDocumentContent(uri: vscode.Uri): vscode.ProviderResult<string> {
			let newUri = uri.with({ scheme: 'file' })
			return workspace.openTextDocument(newUri).then(document => document.getText())
		}
	}

	context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(scheme, provider))
}

function checkPathForJava(envPath: string): string | null {
	const sep = process.platform === 'win32' ? ';' : ":";
	const paths = envPath.split(sep);
	let java: string | null = null;

	for (const spath of paths) {
		const jpath = path.join(spath, 'java');
		if (existsSync(jpath)) {
			java = jpath;
			break;
		}
	}
	return java;
}

function checkFileExists(fileName: string, onSuccess: () => void) {
	const msg = 'Could not find Novah compiler. Make sure you configure it properly in the settings (Compiler Path).';

	if (!fileName) {
		vscode.window.showErrorMessage(msg, { modal: false });
		return;
	}
	const file = vscode.Uri.file(fileName);
	workspace.fs.stat(file).then((_) => onSuccess(), (err) => {
		vscode.window.showErrorMessage(msg, { modal: false });
	});
}