import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="container">
      <div className="card">
        <div className="h1">Not Found</div>
        <div className="hr" />
        <Link to="/">トップへ</Link>
      </div>
    </div>
  );
}

