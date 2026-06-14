import { FindNode	, CanvasSize	} from './Application.js'
import { EscapeXML					} from './DomUtils.js'
import { XYWH		, XYWH_TLBR		} from './geo2D.js'
import { BBox						} from './geoDF.js'
import { LabelLayout				} from './DrawLabel.js'
import { DrawLinkSvg				} from './DrawLink.js'

const
baseName = filename => ( filename ?? 'Untitled' ).replace( /\.[^.]+$/, '' ) || 'Untitled'

const
downloadBlob = ( blob, filename ) => {
	const
	a = document.createElement( 'a' )
	a.href = URL.createObjectURL( blob )
	a.download = filename
	a.click()
	a.remove()
	URL.revokeObjectURL( a.href )
}

const
paintAttrs		= P => {
	const
	a = []
	if	( P.fill )	a.push( `fill="${ EscapeXML( P.fill ) }"` )
	else			a.push( 'fill="none"' )
	if	( P.stroke ) {
		a.push( `stroke="${ EscapeXML( P.stroke ) }"` )
		a.push( `stroke-width="${ P.lineWidth || 1 }"` )
		P.lineCap && a.push( `stroke-linecap="${ P.lineCap }"` )
		P.lineJoin && a.push( `stroke-linejoin="${ P.lineJoin }"` )
		P.lineDash?.length && a.push( `stroke-dasharray="${ P.lineDash.join( ' ' ) }"` )
		P.lineDashOffset && a.push( `stroke-dashoffset="${ P.lineDashOffset }"` )
	}
	return	a.join( ' ' )
}

const
pointsAttr		= ( X, Y, points ) => points.map(
	( [ x, y ] ) => `${ X( x ) },${ Y( y ) }`
).join( ' ' )

const
drawShape		= ( parts, X, Y, S, P ) => {
	const
	attrs = paintAttrs( P )
	switch ( S.type ) {
	case 'rect': {
		const
		[ x, y, w, h ] = XYWH( S )
		const
		r = S.radii ?? 0
		parts.push(
			r
			?	`<rect x="${ X( x ) }" y="${ Y( y ) }" width="${ w }" height="${ h }" rx="${ r }" ry="${ r }" ${ attrs }/>`
			:	`<rect x="${ X( x ) }" y="${ Y( y ) }" width="${ w }" height="${ h }" ${ attrs }/>`
		)
		break
	}
	case 'ellipse':
		parts.push(
			`<ellipse cx="${ X( S.cX ) }" cy="${ Y( S.cY ) }" rx="${ S.rH }" ry="${ S.rV }" ${ attrs }/>`
		)
		break
	case 'rhombus':
		parts.push(
			`<polygon points="${ pointsAttr( X, Y, [
				[ S.cX, S.cY - S.rV ]
			,	[ S.cX + S.rH, S.cY ]
			,	[ S.cX, S.cY + S.rV ]
			,	[ S.cX - S.rH, S.cY ]
			] ) }" ${ attrs }/>`
		)
		break
	}
}

const
drawLabel		= ( parts, X, Y, S ) => {
	if	( !S.html ) return
	const
	{
		lines
	,	fontSize
	,	fontWeight
	,	fontFamily
	,	textAlign
	,	textX
	,	startY
	,	linePx
	,	color
	,	textBaseline
	} = LabelLayout( S )
	const
	anchor = textAlign === 'right' ? 'end' : textAlign === 'left' ? 'start' : 'middle'
	const
	x = X( textX )
	,	y0 = Y( startY )
	,	baselineAttr = textBaseline === 'middle' ? ' dominant-baseline="middle"' : ''
	parts.push(
		`<text x="${ x }" y="${ y0 }" text-anchor="${ anchor }"${ baselineAttr } font-size="${ fontSize }" font-family="${ EscapeXML( fontFamily ) }" font-weight="${ EscapeXML( fontWeight ) }" fill="${ EscapeXML( color ) }">`
	)
	lines.forEach(
		( line, i ) => parts.push(
			i
			?	`<tspan x="${ x }" dy="${ linePx }">${ EscapeXML( line ) }</tspan>`
			:	`<tspan x="${ x }">${ EscapeXML( line ) }</tspan>`
		)
	)
	parts.push( '</text>' )
}

const
drawSvgNode		= ( parts, X, Y, S ) => {
	const
	[ x, y, w, h ] = XYWH( S )
	const
	svgText = new TextDecoder().decode(
		Uint8Array.from( atob( S.SVG ), ch => ch.charCodeAt( 0 ) )
	)
	const
	root = new DOMParser().parseFromString( svgText, 'image/svg+xml' ).documentElement
	const
	vb = root.viewBox.baseVal
	const
	svgW = vb.width || Number.parseFloat( root.getAttribute( 'width' ) ) || w
	const
	svgH = vb.height || Number.parseFloat( root.getAttribute( 'height' ) ) || h
	parts.push(
		`<g transform="translate(${ X( x ) },${ Y( y ) }) scale(${ w / svgW },${ h / svgH })">`
	,	root.innerHTML
	,	'</g>'
	)
}

const
drawPngNode		= ( parts, X, Y, S ) => {
	const
	[ x, y, w, h ] = XYWH( S )
	parts.push(
		`<image href="data:image/png;base64,${ S.PNG }" x="${ X( x ) }" y="${ Y( y ) }" width="${ w }" height="${ h }"/>`
	)
}

const
drawLink		= ( parts, X, Y, shapeF, A, shapeT, P ) => DrawLinkSvg(
	parts, X, Y, shapeF, A, shapeT, P
)

const
saveVectorSVG	= filename => {
	const
	[ x, y, w, h ] = XYWH_TLBR( BBox( app.model.nodes ) )
,	X = _ => _ - x
,	Y = _ => _ - y

	const
	bg = matchMedia( '(prefers-color-scheme: dark)' ).matches ? '#000000' : '#ffffff'
	const
	parts = [
		'<?xml version="1.0" encoding="UTF-8"?>'
	,	`<svg xmlns="http://www.w3.org/2000/svg" width="${ w }" height="${ h }" viewBox="0 0 ${ w } ${ h }">`
	,	`<rect width="100%" height="100%" fill="${ bg }"/>`
	]

	for ( const [ , S, P ] of app.model.nodes ) {
		if	( S.type === 'SVG' ) {
			drawSvgNode( parts, X, Y, S )
			drawLabel( parts, X, Y, S )
			continue
		}
		if	( S.type === 'PNG' ) {
			drawPngNode( parts, X, Y, S )
			drawLabel( parts, X, Y, S )
			continue
		}
		drawShape( parts, X, Y, S, P )
		drawLabel( parts, X, Y, S )
	}

	for ( const [ [ F, A, T ], P ] of app.model.links ) {
		const
		nF = FindNode( F )
		const
		nT = FindNode( T )
		nF && nT && drawLink( parts, X, Y, nF[ 1 ], A, nT[ 1 ], P )
	}

	parts.push( '</svg>' )
	downloadBlob(
		new Blob( [ parts.join( '\n' ) ], { type: 'image/svg+xml' } )
	,	`${ baseName( filename ) }.svg`
	)
}

export const
savePNG = async ( editor, filename ) => {
	const
	canvas = await editor.exportCanvas()
	const
	blob = await new Promise(
		( S, J ) => canvas.toBlob(
			b => b ? S( b ) : J( new Error( 'PNG export failed' ) )
		,	'image/png'
		)
	)
	downloadBlob( blob, `${ baseName( filename ) }.png` )
}

export const
saveSVG = ( editor, filename ) => {
	void editor
	saveVectorSVG( filename )
}
