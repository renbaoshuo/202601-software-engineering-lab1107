import { Route, Routes } from "react-router";
import About from "./pages/About";
import Home from "./pages/Home";

export default function App() {
  return (
    <Routes>
      <Route element={<Home />} path="/" />
      <Route element={<About />} path="/about" />
    </Routes>
  );
}
