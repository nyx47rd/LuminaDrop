import Link from 'next/link'
 
export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-white">
      <h2 className="text-2xl font-bold mb-4">Not Found</h2>
      <p className="mb-4">Could not find requested resource</p>
      <Link href="/" className="px-4 py-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
        Return Home
      </Link>
    </div>
  )
}
