// Generated automatically by nearley, version unknown
// http://github.com/Hardmath123/nearley
function id(x) { return x[0]; }

const Markups_16 = [
	'<h1>__label__</h1>',
	'<h2>__label__</h2>',
	'<p>__label__</p>',
	'<a>__label__</a>',

	'<span>__label__</span>',
	'<b>__label__</b>',
	'<i>__label__</i>',
	'<abbr>__label__</abbr>',

	'<input>__label__</input>',
	'<button>__label__</button>',
	'<select>__label__</select>',
	'<section>__label__</section>',

	'<strong>__label__</strong>',
	'<article>__label__</article>',
	'<header>__label__</header>',
	'<footer>__label__</footer>',
]
let Lexer = undefined;
let ParserRules = [
    {"name": "main$ebnf$1", "symbols": []},
    {"name": "main$ebnf$1", "symbols": ["main$ebnf$1", "Element"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "main", "symbols": ["main$ebnf$1", "rest"], "postprocess": (data) => { let a = data[0].flat(); a.push(data[1]); return a }},
    {"name": "Element", "symbols": ["Char", "OpenTag", "Char", "CloseTag"], "postprocess":  (data) => [data[0], {
            tag: data[1],
            annotation: "<" + data[1] + ">" + data[2] + "</" + data[1] + ">",
            label: data[2],
            optionIndex: Markups_16.findIndex(markup => markup.startsWith("<" + data[1] + ">"))
        }] },
    {"name": "OpenTag", "symbols": [{"literal":"<"}, "TagName", {"literal":">"}], "postprocess": (data) => data[1].join("")},
    {"name": "CloseTag$string$1", "symbols": [{"literal":"<"}, {"literal":"/"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "CloseTag", "symbols": ["CloseTag$string$1", "TagName", {"literal":">"}]},
    {"name": "TagName$ebnf$1", "symbols": [/[a-zA-Z0-9]/]},
    {"name": "TagName$ebnf$1", "symbols": ["TagName$ebnf$1", /[a-zA-Z0-9]/], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "TagName", "symbols": ["TagName$ebnf$1"], "postprocess": (data) => data[0]},
    {"name": "Char$ebnf$1", "symbols": []},
    {"name": "Char$ebnf$1", "symbols": ["Char$ebnf$1", /[^<]/], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "Char", "symbols": ["Char$ebnf$1"], "postprocess": (data) => data[0].join("")},
    {"name": "rest$ebnf$1", "symbols": []},
    {"name": "rest$ebnf$1", "symbols": ["rest$ebnf$1", /./], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "rest", "symbols": ["rest$ebnf$1"], "postprocess": (data) => data[0].join("")}
];
let ParserStart = "main";
export default { Lexer, ParserRules, ParserStart };
