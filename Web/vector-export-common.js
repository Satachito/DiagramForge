import { XYWH } from './diagram-geometry.js'

export const
parseStyle		= style => {
	const	out = {}
	if	( !style ) return out
	style.replace( /\n/g, '' ).split( ';' ).forEach(
		part => {
			const
			i = part.indexOf( ':' )
			if	( i < 0 ) return
			const
			key = part.slice( 0, i ).trim().toLowerCase()
			,	val = part.slice( i + 1 ).trim()
			key && val && ( out[ key ] = val )
		}
	)
	return	out
}

export const
decodeHtml		= html => {
	const	$ = document.createElement( 'textarea' )
	$.innerHTML = html
	return	$.value
}

const
colorProbe		= document.createElement( 'canvas' ).getContext( '2d' )

export const
parseColor		= color => {
	colorProbe.fillStyle = '#000000'
	colorProbe.fillStyle = color
	const
	raw = colorProbe.fillStyle
	if	( raw.startsWith( '#' ) ) {
		const
		n = Number.parseInt( raw.slice( 1 ), 16 )
		return { r: n >> 16 & 255, g: n >> 8 & 255, b: n & 255, a: 1 }
	}
	const
	m = raw.match( /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/ )
	if	( !m ) throw new Error( `Unsupported color: ${ color }` )
	return {
		r	: Number( m[ 1 ] )
	,	g	: Number( m[ 2 ] )
	,	b	: Number( m[ 3 ] )
	,	a	: m[ 4 ] == null ? 1 : Number( m[ 4 ] )
	}
}

export const
wrapLines		= ( measure, text, maxWidth ) => {
	const
	lines = []
	text.split( /\n|<br\s*\/?>/i ).forEach(
		paragraph => {
			const
			words = paragraph.trim().split( /\s+/ ).filter( Boolean )
			if	( !words.length ) {
				lines.push( '' )
				return
			}
			let
			line = words[ 0 ]
			for	( let i = 1; i < words.length; i++ ) {
				const
				next = `${ line } ${ words[ i ] }`
				if	( measure( next ) > maxWidth && line ) {
					lines.push( line )
					line = words[ i ]
				} else	line = next
			}
			lines.push( line )
		}
	)
	return	lines.length ? lines : [ '' ]
}

export const
labelLayout		= S => {
	const
	st = parseStyle( S.style )
	,	fontSize = parseFloat( st[ 'font-size' ] ) || 12
	,	fontWeight = st[ 'font-weight' ] || 'normal'
	,	fontFamily = st[ 'font-family' ] || 'courier, monospace'
	,	lineHeight = parseFloat( st[ 'line-height' ] ) || 1.2
	,	textAlign = st[ 'text-align' ] || 'center'
	,	[ x, y, w, h ] = XYWH( S )
	,	pad = 4
	,	innerW = Math.max( 0, w - pad * 2 )
	,	color = matchMedia( '(prefers-color-scheme: dark)' ).matches ? '#ffffff' : '#000000'
	,	measureCanvas = document.createElement( 'canvas' ).getContext( '2d' )
	measureCanvas.font = `${ fontWeight } ${ fontSize }px ${ fontFamily }`
	const
	lines = wrapLines( _ => measureCanvas.measureText( _ ).width, decodeHtml( S.html ), innerW )
	,	linePx = fontSize * lineHeight
	,	blockH = lines.length * linePx
	,	alignItems = st[ 'align-items' ] || st[ 'place-items' ] || 'center'
	let
	startY = y + ( h - blockH ) / 2 + fontSize
	if	( /flex-end|end/.test( alignItems ) )	startY = y + h - pad - blockH + fontSize
	else if	( /flex-start|start/.test( alignItems ) )	startY = y + pad + fontSize
	const
	textX = textAlign === 'right'
	?	x + w - pad
	:	textAlign === 'left'
	?	x + pad
	:	x + w / 2
	return {
		lines
	,	fontSize
	,	fontWeight
	,	fontFamily
	,	textAlign
	,	textX
	,	startY
	,	linePx
	,	color
	}
}
