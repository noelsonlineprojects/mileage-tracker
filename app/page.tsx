'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from './lib/supabase'
import { LoadScript, Autocomplete } from '@react-google-maps/api'

const libraries: ('places')[] = ['places']

export default function Home() {
  const [trips, setTrips] = useState<any[]>([])
  const [date, setDate] = useState('')
  const [startAddress, setStartAddress] = useState('')
  const [endAddress, setEndAddress] = useState('')
  const [miles, setMiles] = useState('')
  const [purpose, setPurpose] = useState('')

  const startAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const endAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)

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

  function calculateDistance(origin: string, destination: string) {
    if (!origin || !destination) return
    const service = new google.maps.DistanceMatrixService()
    service.getDistanceMatrix(
      {
        origins: [origin],
        destinations: [destination],
        travelMode: google.maps.TravelMode.DRIVING,
        unitSystem: google.maps.UnitSystem.IMPERIAL,
      },
      (response, status) => {
        if (status === 'OK' && response) {
          const element = response.rows[0].elements[0]
          if (element.status === 'OK') {
            const meters = element.distance.value
            const calculatedMiles = (meters / 1609.34).toFixed(1)
            setMiles(calculatedMiles)
          }
        }
      }
    )
  }

  function onStartPlaceChanged() {
    const place = startAutocompleteRef.current?.getPlace()
    if (place?.formatted_address) {
      setStartAddress(place.formatted_address)
      if (endAddress) calculateDistance(place.formatted_address, endAddress)
    }
  }

  function onEndPlaceChanged() {
    const place = endAutocompleteRef.current?.getPlace()
    if (place?.formatted_address) {
      setEndAddress(place.formatted_address)
      if (startAddress) calculateDistance(startAddress, place.formatted_address)
    }
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
    <LoadScript
      googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}
      libraries={libraries}
    >
      <main style={{ maxWidth: 600, margin: '0 auto', padding: 24 }}>
        <h1>Mileage Tracker</h1>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />

          <Autocomplete
            onLoad={(ac) => (startAutocompleteRef.current = ac)}
            onPlaceChanged={onStartPlaceChanged}
          >
            <input
              type="text"
              placeholder="Start address"
              value={startAddress}
              onChange={(e) => setStartAddress(e.target.value)}
              required
            />
          </Autocomplete>

          <Autocomplete
            onLoad={(ac) => (endAutocompleteRef.current = ac)}
            onPlaceChanged={onEndPlaceChanged}
          >
            <input
              type="text"
              placeholder="End address"
              value={endAddress}
              onChange={(e) => setEndAddress(e.target.value)}
              required
            />
          </Autocomplete>

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
    </LoadScript>
  )
}