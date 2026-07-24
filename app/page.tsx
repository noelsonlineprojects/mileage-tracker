'use client'

import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'

export default function Home() {
  const [trips, setTrips] = useState<any[]>([])
  const [date, setDate] = useState('')
  const [startAddress, setStartAddress] = useState('')
  const [endAddress, setEndAddress] = useState('')
  const [miles, setMiles] = useState('')
  const [purpose, setPurpose] = useState('')

  useEffect(() => {
    fetchTrips()
  }, [])

  async function fetchTrips() {
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .order('date', { ascending: false })
    if (error) console.error(error)
    else setTrips(data || [])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('trips').insert([
      {
        date,
        start_address: startAddress,
        end_address: endAddress,
        miles: parseFloat(miles),
        purpose,
      },
    ])
    if (error) {
      console.error(error)
      alert('Error saving trip')
    } else {
      setDate('')
      setStartAddress('')
      setEndAddress('')
      setMiles('')
      setPurpose('')
      fetchTrips()
    }
  }

  return (
    <main style={{ maxWidth: 600, margin: '0 auto', padding: 24 }}>
      <h1>Mileage Tracker</h1>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        <input type="text" placeholder="Start address" value={startAddress} onChange={(e) => setStartAddress(e.target.value)} required />
        <input type="text" placeholder="End address" value={endAddress} onChange={(e) => setEndAddress(e.target.value)} required />
        <input type="number" step="0.1" placeholder="Miles" value={miles} onChange={(e) => setMiles(e.target.value)} required />
        <input type="text" placeholder="Purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
        <button type="submit">Add Trip</button>
      </form>

      <h2>Trips</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Date</th>
            <th style={{ textAlign: 'left' }}>From</th>
            <th style={{ textAlign: 'left' }}>To</th>
            <th style={{ textAlign: 'left' }}>Miles</th>
            <th style={{ textAlign: 'left' }}>Purpose</th>
          </tr>
        </thead>
        <tbody>
          {trips.map((trip) => (
            <tr key={trip.id}>
              <td>{trip.date}</td>
              <td>{trip.start_address}</td>
              <td>{trip.end_address}</td>
              <td>{trip.miles}</td>
              <td>{trip.purpose}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}