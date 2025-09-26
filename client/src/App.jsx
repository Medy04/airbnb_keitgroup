import React from 'react'
import { Routes, Route, Link, NavLink } from 'react-router-dom'
import Header from './components/Header.jsx'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import Admin from './pages/Admin.jsx'
import AdminLogin from './pages/AdminLogin.jsx'
import './styles.css'

export default function App(){
  return (
    <div className="app">
      <Header />
      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/admin/*" element={<Admin />} />
          <Route path="/admin-login" element={<AdminLogin />} />
        </Routes>
      </main>
    </div>
  )
}
