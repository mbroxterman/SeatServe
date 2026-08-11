import { Link } from "react-router-dom";
import PageState from "../components/ui/PageState";

export default function NotFound() {
  return <PageState title="Page not found" description="The requested SeatServe page does not exist." action={<Link className="button" to="/admin">Return to dashboard</Link>} />;
}
