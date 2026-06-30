//	S.html / S.style の HTML + CSS を SVG foreignObject として描画する。
//	注意: ここではサニタイズしない。信頼できない .zu を扱う場合は、
//	読み込み前に HTML ラベルを除去するか、許可リスト方式で無害化すること。

import { EscapeXML } from './DomUtils.js'
import { XYWH } from './GeoZU.js'

const
labelWrapperStyle	= S => {
	const
	color = matchMedia( '(prefers-color-scheme: dark)' ).matches ? '#ffffff' : '#000000'
	//	div が foreignObject 全体を埋めることで、ノード側の flex/grid 指定
	//	( place-items:center など ) でラベルを中央寄せできる。
	//	height:100% がないと div が内容サイズに縮み、文字が上に寄る。
	return	`width:100%;height:100%;box-sizing:border-box;color-scheme:light dark;color:${ color };${ ( S.style || '' ).replace( /\n/g, '' ) }`
}

//	foreignObject の中身は well-formed XML である必要がある。
//	いったん HTML としてパースし、bare &, bare <, <br>/<img> などの void 要素、
//	引用符なし属性をブラウザの寛容なパーサに吸収させてから XML として再直列化する。
const
htmlToXhtml		= html => {
	const
	{ body } = new DOMParser().parseFromString( String( html ), 'text/html' )
	return	new XMLSerializer().serializeToString( body )
		.replace( /^<body[^>]*>/, '' )
		.replace( /<\/body>$/, '' )
}

export const
foreignObjectSvg	= S => {
	const
	[ w, h ] = [ S.rH * 2, S.rV * 2 ]
	,	style = labelWrapperStyle( S )
	,	body = htmlToXhtml( S.html )
	return	`<svg xmlns="http://www.w3.org/2000/svg" width="${ w }" height="${ h }" viewBox="0 0 ${ w } ${ h }"><foreignObject x="0" y="0" width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="${ EscapeXML( style ) }">${ body }</div></foreignObject></svg>`
}

export const
DrawForeignLabel	= async ( drawSVG, S ) => {
	if	( !S.html ) return
	await drawSVG( [ foreignObjectSvg( S ) ], S )
}

export const
drawForeignLabelSvg	= ( parts, X, Y, S ) => {
	if	( !S.html ) return
	const
	[ x, y, w, h ] = XYWH( S )
	,	style = labelWrapperStyle( S )
	,	body = htmlToXhtml( S.html )
	parts.push(
		`<foreignObject x="${ X( x ) }" y="${ Y( y ) }" width="${ w }" height="${ h }">`
	,	`<div xmlns="http://www.w3.org/1999/xhtml" style="${ EscapeXML( style ) }">${ body }</div>`
	,	`</foreignObject>`
	)
}
