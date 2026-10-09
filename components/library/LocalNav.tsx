import Link from "next/link";
export function LocalNav() {
  return (
    <nav className="local-nav">
      <Link href="/" className="mr-auto">
        <strong className="brand">IELTS</strong> <strong>Simulator</strong>
      </Link>
      <Link href="/">Library</Link>
      <Link href="/?mode=practice">Practice</Link>
      <Link href="/?mode=mock">Mock Test</Link>
      <Link href="/history">History</Link>
      <Link href="/mistakes">Mistakes</Link>
      <Link href="/import">Import</Link>
    </nav>
  );
}
