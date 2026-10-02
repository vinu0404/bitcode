import Link from "next/link";
import ErrorScreen from "@/components/bc/ErrorScreen";
import Button from "@/components/ui/Button";

export default function NotFound() {
  return (
    <ErrorScreen
      code="404 / NO SUCH PAGE"
      word="No signal."
      body="This page does not exist, or it moved. The problems are still where you left them."
      actions={
        <>
          <Link href="/bitcode">
            <Button variant="primary" size="lg">
              Go to problems
            </Button>
          </Link>
          <Link href="/">
            <Button variant="secondary" size="lg">
              Home
            </Button>
          </Link>
        </>
      }
    />
  );
}
