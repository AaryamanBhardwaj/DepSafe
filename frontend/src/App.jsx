import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import Package from './pages/Package'
import Compare from './pages/Compare'
import Tree from './pages/Tree'
import NotFound from './pages/NotFound'
import Nav from './components/Nav'

export default function App() {
  return (
    <div className="min-h-screen bg-[#0f172a]">
      <Nav />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/package/:name" element={<Package />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/tree/:name" element={<Tree />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  )
}
