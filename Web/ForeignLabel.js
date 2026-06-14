//	Render node labels via SVG foreignObject (HTML + CSS in S.html / S.style).

import { EscapeXML } from './DomUtils.js'
import { XYWH } from './geo2D.js'

const
labelWrapperStyle	= S => {
	const
	color = matchMedia( '(prefers-color-scheme: dark)' ).matches ? '#ffffff' : '#000000'
	return	`color:${ color };${ ( S.style || '' ).replace( /\n/g, '' ) }`
}

const
htmlToXhtml		= html => String( html ).replace( /<br\s*>/gi, '<br/>' )

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
