const
SIG = {
	LOCAL		: 0x04034b50
,	CENTRAL		: 0x02014b50
,	EOCD		: 0x06054b50
}

const
u16 = ( buf, off ) => buf[ off ] | buf[ off + 1 ] << 8

const
u32 = ( buf, off ) =>
	buf[ off ] | buf[ off + 1 ] << 8 | buf[ off + 2 ] << 16 | buf[ off + 3 ] << 24

const
findEocd = buf => {
	const
	min = Math.max( 0, buf.length - 22 - 65535 )
	for	( let i = buf.length - 22; i >= min; i-- ) {
		if	( u32( buf, i ) !== SIG.EOCD ) continue
		const
		commentLen = u16( buf, i + 20 )
		if	( i + 22 + commentLen === buf.length ) return i
	}
	throw new Error( 'ZIP: end of central directory not found' )
}

const
inflateRaw = async compressed => new Uint8Array(
	await new Response(
		new Blob( [ compressed ] ).stream().pipeThrough(
			new DecompressionStream( 'deflate-raw' )
		)
	).arrayBuffer()
)

const
extractEntry = async ( buf, { localOffset, method, compressedSize, uncompressedSize } ) => {
	if	( u32( buf, localOffset ) !== SIG.LOCAL ) {
		throw new Error( `ZIP: bad local header at ${ localOffset }` )
	}
	const
	nameLen = u16( buf, localOffset + 26 )
,	extraLen = u16( buf, localOffset + 28 )
,	dataOffset = localOffset + 30 + nameLen + extraLen
,	compressed = buf.subarray( dataOffset, dataOffset + compressedSize )
	if	( method === 0 ) return compressed.slice( 0, uncompressedSize )
	if	( method === 8 ) return inflateRaw( compressed )
	throw new Error( `ZIP: unsupported compression method ${ method }` )
}

const
readEntries = ( buf, filter ) => {
	const
	eocd = findEocd( buf )
,	cdOffset = u32( buf, eocd + 16 )
,	cdSize = u32( buf, eocd + 12 )
,	cdEnd = cdOffset + cdSize
,	entries = []
	let
	p = cdOffset
	while ( p < cdEnd ) {
		if	( u32( buf, p ) !== SIG.CENTRAL ) break
		const
		method = u16( buf, p + 10 )
	,	compressedSize = u32( buf, p + 20 )
	,	uncompressedSize = u32( buf, p + 24 )
	,	nameLen = u16( buf, p + 28 )
	,	extraLen = u16( buf, p + 30 )
	,	commentLen = u16( buf, p + 32 )
	,	localOffset = u32( buf, p + 42 )
	,	name = new TextDecoder().decode( buf.subarray( p + 46, p + 46 + nameLen ) )
		p += 46 + nameLen + extraLen + commentLen
		if	( filter && !filter( name ) ) continue
		entries.push( { name, localOffset, method, compressedSize, uncompressedSize } )
	}
	return entries
}

const
mapPool = async ( items, limit, fn ) => {
	const
	out = new Array( items.length )
	let
	i = 0
	await Promise.all(
		Array.from(
			{ length: Math.min( limit, items.length ) }
		,	async () => {
				while ( true ) {
					const
					j = i++
					if	( j >= items.length ) break
					out[ j ] = await fn( items[ j ], j )
				}
			}
		)
	)
	return out
}

export const
unzip = async ( data, filter ) => {
	const
	buf = data instanceof Uint8Array ? data : new Uint8Array( data )
,	entries = readEntries( buf, filter )
	if	( !entries.length ) throw new Error( 'ZIP: no matching entries' )
	const
	results = await mapPool(
		entries
	,	8
	,	async entry => {
			const
			bytes = await extractEntry( buf, entry )
			return [ entry.name, bytes ]
		}
	)
	const
	out = {}
	for ( const row of results ) {
		const
		[ name, bytes ] = row
		out[ name ] = bytes
	}
	return out
}
