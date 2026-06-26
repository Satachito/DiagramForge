import { FindNode, CanvasSize	} from './Application.js'
import { XYWH, LinkMetrics, shaftSpec	} from './GeoDF.js'
import { drawForeignLabelSvg	} from './ForeignLabel.js'

const
DrawHeadSvg		= ( parts, X, Y, h, headFill, stroke, headWidth ) => {
	if	( h.kind === 'circle' ) {
		const
		fill = h.fill ? `fill="${ headFill }"` : `fill="none" stroke="${ stroke }" stroke-width="${ headWidth }"`
		parts.push(
			`<circle cx="${ X( h.center[ 0 ] ) }" cy="${ Y( h.center[ 1 ] ) }" r="${ h.r }" ${ fill }/>`
		)
		return
	}
	const
	pts = pointsAttr( X, Y, h.pts )
	if	( h.kind === 'line' ) {
		parts.push(
			`<polyline points="${ pts }" fill="none" stroke="${ stroke }" stroke-width="${ headWidth }" stroke-linecap="round" stroke-linejoin="round"/>`
		)
		return
	}
	const
	fill = h.fill ? `fill="${ headFill }" stroke="none"` : `fill="none" stroke="${ stroke }" stroke-width="${ headWidth }" stroke-linejoin="round"`
	parts.push(
		`<polygon points="${ pts }" ${ fill }/>`
	)
}

const
DrawLinkSvg		= ( parts, X, Y, link ) => {
	const
	$ = LinkMetrics( link )
	if	( !$ ) return

	const
	P = link[ 2 ]
	,	a = [
		`stroke="${ P.stroke }"`
	,	`stroke-linecap="${ P.lineCap || 'butt' }"`
	,	`stroke-linejoin="${ P.lineJoin || 'round' }"`
	]
	P.lineWidth			&& a.push( `stroke-width="${ P.lineWidth }"` )
	P.lineDash			&& a.push( `stroke-dasharray="${ P.lineDash.join( ' ' ) }"` )
	P.lineDashOffset	&& a.push( `stroke-dashoffset="${ P.lineDashOffset }"` )

	parts.push(
		`<path d="${ shaftPathD( X, Y, shaftSpec( $.shaft, link[ 1 ].corner ) ) }" fill="none" ${ a.join( ' ' ) }/>`
	)
	const
	headFill = P.fill ?? P.stroke
	,	headWidth = P.lineWidth || 1
	for ( const h of $.heads )	DrawHeadSvg( parts, X, Y, h, headFill, P.stroke, headWidth )
}

export const
baseName = filename => ( filename ?? 'Untitled' ).replace( /\.[^.]+$/, '' ) || 'Untitled'

export const
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
	let
	$ = `fill="${P.fill ? P.fill :	'none' }"`
	P.stroke			&& ( $ += ` stroke="${ ( P.stroke ) }"`						)
	P.lineWidth			&& ( $ += ` stroke-width="${ P.lineWidth }"`				)
	P.lineCap			&& ( $ += ` stroke-linecap="${ P.lineCap }"`				)
	P.lineJoin			&& ( $ += ` stroke-linejoin="${ P.lineJoin }"`				)
	P.lineDash			&& ( $ += ` stroke-dasharray="${ P.lineDash.join( ' ' ) }"`	)
	P.lineDashOffset	&& ( $ += ` stroke-dashoffset="${ P.lineDashOffset }"`		)
	return	$
}

const
pointsAttr		= ( X, Y, points ) => points.map(
	( [ x, y ] ) => `${ X( x ) },${ Y( y ) }`
).join( ' ' )

const
shaftPathD		= ( X, Y, s ) => {
	const	P = ( [ x, y ] ) => `${ X( x ) } ${ Y( y ) }`
	switch	( s.type ) {
	case 'quad'	:
		return	`M ${ P( s.p0 ) } Q ${ P( s.c ) } ${ P( s.p1 ) }`
	case 'cubic'	:
		return	`M ${ P( s.p0 ) } C ${ P( s.c1 ) } ${ P( s.c2 ) } ${ P( s.p1 ) }`
	case 'arc'	:
		return	`M ${ P( s.start ) }`
			+ s.corners.map( k => ` L ${ P( k.a ) } A ${ k.r } ${ k.r } 0 0 ${ k.sweep } ${ P( k.b ) }` ).join( '' )
			+ ` L ${ P( s.end ) }`
	default		:	//	'line'
		return	`M ${ s.pts.map( P ).join( ' L ' ) }`
	}
}

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
buildVectorSVG	= () => {
	if	( !app.model.nodes.length ) return null

	//	export the full canvas ( origin top-left ), not the node bounding box
	const
	[ w, h ] = CanvasSize()
,	X = _ => _
,	Y = _ => _
,	bg = matchMedia( '(prefers-color-scheme: dark)' ).matches ? '#000000' : '#ffffff'
,	parts = [
	'<?xml version="1.0" encoding="UTF-8"?>'
,	`<svg xmlns="http://www.w3.org/2000/svg" width="${ w }" height="${ h }" viewBox="0 0 ${ w } ${ h }">`
,	`<rect width="100%" height="100%" fill="${ bg }"/>`
]

	for ( const [ , S, P ] of app.model.nodes ) {
		if	( S.type === 'SVG' ) {
			drawSvgNode( parts, X, Y, S )
			drawForeignLabelSvg( parts, X, Y, S )
			continue
		}
		if	( S.type === 'PNG' ) {
			drawPngNode( parts, X, Y, S )
			drawForeignLabelSvg( parts, X, Y, S )
			continue
		}
		drawShape( parts, X, Y, S, P )
		drawForeignLabelSvg( parts, X, Y, S )
	}

	for ( const [ [ F, T ], A, P ] of app.model.links ) {
		const
		nF = FindNode( F )
	,	nT = FindNode( T )
		nF && nT && DrawLinkSvg(
			parts, X, Y, [ [ nF, nT ], A, P ]
		)
	}

	parts.push( '</svg>' )
	return { svg: parts.join( '\n' ), w, h }
}

const
saveVectorSVG	= filename => {
	const
	built = buildVectorSVG()
	if	( !built ) throw new Error( 'Nothing to export' )
	downloadBlob(
		new Blob( [ built.svg ], { type: 'image/svg+xml' } )
	,	`${ baseName( filename ) }.svg`
	)
}

export const
saveSVG = async ( editor, filename ) => {
	void editor
	saveVectorSVG( filename )
}

//	Copy the full-fidelity vector SVG to the clipboard. SVG is origin-clean ( no
//	canvas, no taint ), so this just works. text/plain carries the markup — vector
//	tools ( Figma / Illustrator / Inkscape ) paste it as editable vectors, editors
//	paste the source. Also offer image/svg+xml where the browser allows it.
export const
copySVG		= async () => {
	const
	built = buildVectorSVG()
	if	( !built ) throw new Error( 'Nothing to export' )
	const
	{ svg } = built
	try {
		await navigator.clipboard.write( [
			new ClipboardItem( {
				'image/svg+xml'	: new Blob( [ svg ], { type: 'image/svg+xml' } )
			,	'text/plain'	: new Blob( [ svg ], { type: 'text/plain'	 } )
			} )
		] )
	} catch {
		//	browsers that reject image/svg+xml on the clipboard: fall back to markup
		await navigator.clipboard.writeText( svg )
	}
}

//	PDF via the browser's own print engine: drop the full-fidelity vector SVG
//	( foreignObject HTML labels and all ) into a hidden iframe sized to the canvas,
//	then print. The print renderer keeps labels exactly as on screen and emits a
//	vector PDF — no canvas, so no taint, and no PDF library to hand-roll.
export const
printPDF	= filename => {
	const
	built = buildVectorSVG()
	if	( !built ) throw new Error( 'Nothing to export' )
	const
	{ svg, w, h } = built
	,	inline = svg.replace( /^<\?xml[^>]*\?>\s*/, '' )	//	XML prolog is invalid inside HTML

	const
	iframe = document.createElement( 'iframe' )
	iframe.setAttribute( 'aria-hidden', 'true' )
	iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'

	const	cleanup = () => iframe.isConnected && iframe.remove()

	iframe.onload = () => {
		const	win = iframe.contentWindow
		win.onafterprint = cleanup
		//	let foreignObject labels and images paint before printing
		setTimeout( () => ( win.focus(), win.print() ), 100 )
		setTimeout( cleanup, 60000 )	//	fallback if onafterprint never fires
	}

	document.body.appendChild( iframe )
	const	doc = iframe.contentDocument
	doc.open()
	doc.write(
		`<!doctype html><html><head><meta charset="utf-8"><title>${ baseName( filename ) }</title>`
	+	`<style>@page{size:${ w }px ${ h }px;margin:0}html,body{margin:0;padding:0}svg{display:block}</style>`
	+	`</head><body>${ inline }</body></html>`
	)
	doc.close()
}
