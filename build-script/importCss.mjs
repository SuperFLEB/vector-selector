import MagicString from "magic-string";
import path from "node:path";

let config;

export default function importCss(exportName) {
	const filePath = path.resolve(`./${exportName ?? "UNKNOWN"}.css`);
	const cssFakeImport = `\\0IMPORT-CSS-PLUGIN-WAS-HERE:${filePath}`;
	return {
		name: 'importCss',
		configResolved(resolvedConfig) {
			config = resolvedConfig;
		},
		resolveId(id) {
			if (id === "[css]") {
				if (config.lib) {
					return {
						id: cssFakeImport,
						external: true,
						moduleSideEffects: true,
					};
				}
			}
			return id;
		},
		load(id) {
			// This handles the dev server where renderChunk never happens and it actually tries to resolve the temporary import.
			// Since it's the dev server so the CSS gets included automatically we can just ignore the import entirely.
			if (id === "[css]") return "";
			if (id === cssFakeImport) return "";
		},
		renderChunk(code, chunk) {
			const s = new MagicString(code);
			if (code.includes(cssFakeImport)) {
				const chunkDir = path.dirname(chunk.fileName);
				const relativePath = path.relative(chunkDir, filePath);
				const normalizedPath = relativePath.split(path.sep).join('/');
				const prepended = normalizedPath.startsWith(".") ? normalizedPath : './' + normalizedPath;
				s.replaceAll(cssFakeImport, prepended);
				return {
					code: s.toString(),
					map: s.generateMap({ hires: true })
				};
			}
			return null;
		}
	};
}
