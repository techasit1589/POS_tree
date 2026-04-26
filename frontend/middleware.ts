export const config = {
  matcher: ['/((?!api/verify-pin|pin\\.html|favicon\\.ico|assets/).*)'],
}

export default function middleware(request: Request) {
  const cookie = request.headers.get('cookie') ?? ''
  const verified = cookie.split(';').some(c => c.trim() === 'pin_ok=1')
  if (!verified) {
    return Response.redirect(new URL('/pin.html', request.url), 302)
  }
}
