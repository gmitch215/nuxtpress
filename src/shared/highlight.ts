import hljs from 'highlight.js/lib/common';
import clojure from 'highlight.js/lib/languages/clojure';
import dart from 'highlight.js/lib/languages/dart';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import elixir from 'highlight.js/lib/languages/elixir';
import gradle from 'highlight.js/lib/languages/gradle';
import groovy from 'highlight.js/lib/languages/groovy';
import haskell from 'highlight.js/lib/languages/haskell';
import julia from 'highlight.js/lib/languages/julia';
import latex from 'highlight.js/lib/languages/latex';
import nginx from 'highlight.js/lib/languages/nginx';
import nix from 'highlight.js/lib/languages/nix';
import ocaml from 'highlight.js/lib/languages/ocaml';
import powershell from 'highlight.js/lib/languages/powershell';
import protobuf from 'highlight.js/lib/languages/protobuf';
import scala from 'highlight.js/lib/languages/scala';
import vim from 'highlight.js/lib/languages/vim';

// the full build is about 1 MB; common covers 36 languages and these add the usual blog extras
const extras = {
	clojure,
	dart,
	dockerfile,
	elixir,
	gradle,
	groovy,
	haskell,
	julia,
	latex,
	nginx,
	nix,
	ocaml,
	powershell,
	protobuf,
	scala,
	vim
};

for (const [name, language] of Object.entries(extras)) hljs.registerLanguage(name, language);

export default hljs;
