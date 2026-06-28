//	Validate a Zukai model ( same rules as Web/ai-api.js ).

const
isNum	= v => typeof v === 'number' && Number.isFinite( v )

const
validateNode	= ( n, ids, issues, i ) => {
	if	( !Array.isArray( n ) || n.length < 2 ) {
		issues.push( `node[${ i }] must be [ ID, area, paint? ]` )
		return
	}
	const	[ ID, S ] = n
	if	( !ID || typeof ID !== 'string' )	issues.push( `node[${ i }] has an empty / non-string ID` )
	else if	( ids.has( ID ) )				issues.push( `duplicate node ID "${ ID }"` )
	else									ids.add( ID )
	if	( !S || typeof S !== 'object' ) {
		issues.push( `node "${ ID }" is missing its area object` )
		return
	}
	if	( !S.type )	issues.push( `node "${ ID }" is missing "type"` )
	for	( const k of [ 'cX', 'cY', 'rH', 'rV' ] )
		if	( !isNum( S[ k ] ) )	issues.push( `node "${ ID }" ${ k } must be a number` )
	if	( isNum( S.rH ) && isNum( S.rV ) && !( Math.abs( S.rH ) > 2.5 && Math.abs( S.rV ) > 2.5 ) )
		issues.push( `node "${ ID }" is too small ( width / height must exceed 5px )` )
}

const
validateLink	= ( l, ids, seen, issues, i ) => {
	if	( !Array.isArray( l ) || !Array.isArray( l[ 0 ] ) ) {
		issues.push( `link[${ i }] must be [ [ from, to ], ends, paint? ]` )
		return
	}
	const	[ [ F, T ] ] = l
	if	( !F || !T )		{ issues.push( `link[${ i }] is missing an endpoint` ); return }
	if	( F === T )			issues.push( `link[${ i }] is a self-link on "${ F }"` )
	if	( !ids.has( F ) )	issues.push( `link[${ i }] from "${ F }" is not a node` )
	if	( !ids.has( T ) )	issues.push( `link[${ i }] to "${ T }" is not a node` )
	const	key = `${ F }\u0000${ T }`
	if	( seen.has( key ) )	issues.push( `duplicate link ${ F } → ${ T }` )
	else					seen.add( key )
}

export const
validateModel	= model => {
	const
	issues = []
	,	ids = new Set
	;( model?.nodes ?? [] ).forEach( ( n, i ) => validateNode( n, ids, issues, i ) )
	const	seen = new Set
	;( model?.links ?? [] ).forEach( ( l, i ) => validateLink( l, ids, seen, issues, i ) )
	return	issues
}

export const
parseCdeText	= text => {
	const
	doc = JSON.parse( text )
	if	( !doc?.model ) throw new Error( '.zu root must include "model"' )
	return	doc
}

export const
formatCdeDoc	= doc => JSON.stringify( doc, null, '\t' )
