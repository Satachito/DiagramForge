import { XYWH } from './geo2D.js'

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
parsePadding	= st => {
	const
	num = v => parseFloat( v ) || 0
	if	( st[ 'padding-left' ] || st[ 'padding-top' ] || st[ 'padding-right' ] || st[ 'padding-bottom' ] ) {
		return {
			t	: num( st[ 'padding-top' ] )
		,	r	: num( st[ 'padding-right' ] || st[ 'padding-left' ] )
		,	b	: num( st[ 'padding-bottom' ] || st[ 'padding-top' ] )
		,	l	: num( st[ 'padding-left' ] )
		}
	}
	if	( st.padding ) {
		const
		parts = st.padding.split( /\s+/ ).map( num )
		if	( parts.length === 1 )	return { t: parts[ 0 ], r: parts[ 0 ], b: parts[ 0 ], l: parts[ 0 ] }
		if	( parts.length === 2 )	return { t: parts[ 0 ], r: parts[ 1 ], b: parts[ 0 ], l: parts[ 1 ] }
		if	( parts.length >= 4 )	return { t: parts[ 0 ], r: parts[ 1 ], b: parts[ 2 ], l: parts[ 3 ] }
	}
	return	{ t: 4, r: 4, b: 4, l: 4 }
}

export const
parseLinePx	= ( st, fontSize ) => {
	const
	raw = st[ 'line-height' ]
	if	( !raw ) return fontSize * 1.2
	const
	n = parseFloat( raw )
	if	( /px\s*$/i.test( raw ) || n > 4 ) return n
	return	fontSize * n
}

const
alignStart	= _ => /^(flex-start|start)$/.test( _ )
,	alignEnd	= _ => /^(flex-end|end)$/.test( _ )

export const
labelY		= ( { y, h, blockH, linePx, fontSize, padT, padB, alignItems, middle } ) => {
	if	( middle ) {
		if	( alignEnd( alignItems ) )	return y + h - padB - blockH + linePx / 2
		if	( alignStart( alignItems ) )	return y + padT + linePx / 2
		return	y + ( h - blockH ) / 2 + linePx / 2
	}
	if	( alignEnd( alignItems ) )	return y + h - padB - blockH + fontSize
	if	( alignStart( alignItems ) )	return y + padT + fontSize
	return	y + ( h - blockH ) / 2 + fontSize
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
,	textAlign = st[ 'text-align' ] || 'center'
,	[ x, y, w, h ] = XYWH( S )
,	{ t: padT, r: padR, b: padB, l: padL } = parsePadding( st )
,	innerW = Math.max( 0, w - padL - padR )
,	color = matchMedia( '(prefers-color-scheme: dark)' ).matches ? '#ffffff' : '#000000'
,	middle = st[ 'text-baseline' ] === 'middle'
,	measureCanvas = document.createElement( 'canvas' ).getContext( '2d' )
	measureCanvas.font = `${ fontWeight } ${ fontSize }px ${ fontFamily }`
	const
	lines = wrapLines( _ => measureCanvas.measureText( _ ).width, decodeHtml( S.html ), innerW )
,	linePx = parseLinePx( st, fontSize )
,	blockH = lines.length * linePx
,	alignItems = st[ 'align-items' ] || st[ 'place-items' ] || 'center'
,	startY = labelY( { y, h, blockH, linePx, fontSize, padT, padB, alignItems, middle } )
	const
	textX = textAlign === 'right'
	?	x + w - padR
	:	textAlign === 'left'
	?	x + padL
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
	,	textBaseline	: middle ? 'middle' : 'alphabetic'
	}
}
