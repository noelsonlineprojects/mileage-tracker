'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { supabase } from './lib/supabase'
import { LoadScript, Autocomplete } from '@react-google-maps/api'

const libraries: ('places')[] = ['places']

const OFFICE_ADDRESS = '2004 W Garden St, Pensacola, FL 32502, USA'

export default function Home() {
  const [trips, setTrips] = useState<any[]>([])
  const [date, setDate] = useState('')
  const [startAddress, setStartAddress] = useState(OFFICE_ADDRESS)
  const [endAddress, setEndAddress] = useState('')
  const [miles, setMiles] = useState('')
  const [purpose, setPurpose] = useState('')
  const [isRoundTrip, setIsRoundTrip] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  const currentMonth = new Date().toISOString().slice(0, 7)
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)

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
      .order('submitted_at', { ascending: false, nullsFirst: false })
      .order('id', { ascending: true })
    if (error) console.error(error)
    else setTrips(data || [])
  }

  function getRecentPlaces() {
    const addresses = trips.flatMap((t) => [t.start_address, t.end_address])
    const unique = Array.from(new Set(addresses)).filter((a) => a && a !== OFFICE_ADDRESS)
    return unique.slice(0, 5)
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

  function resetForm() {
    setDate('')
    setStartAddress(OFFICE_ADDRESS)
    setEndAddress('')
    setMiles('')
    setPurpose('')
    setIsRoundTrip(false)
    setEditingId(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (editingId !== null) {
      const { error } = await supabase
        .from('trips')
        .update({
          date,
          start_address: startAddress,
          end_address: endAddress,
          miles: parseFloat(miles),
          purpose,
        })
        .eq('id', editingId)

      if (error) {
        console.error(error)
        alert('Error updating trip')
      } else {
        resetForm()
        fetchTrips()
      }
      return
    }

    const submittedAt = new Date().toISOString()

    const rowsToInsert = [
      {
        date,
        start_address: startAddress,
        end_address: endAddress,
        miles: parseFloat(miles),
        purpose,
        submitted_at: submittedAt,
      },
    ]

    if (isRoundTrip) {
      rowsToInsert.push({
        date,
        start_address: endAddress,
        end_address: startAddress,
        miles: parseFloat(miles),
        purpose: purpose ? `${purpose} (return)` : 'Return trip',
        submitted_at: submittedAt,
      })
    }

    const { error } = await supabase.from('trips').insert(rowsToInsert)

    if (error) {
      console.error(error)
      alert('Error saving trip')
    } else {
      resetForm()
      fetchTrips()
    }
  }

  function startEdit(trip: any) {
    setEditingId(trip.id)
    setDate(trip.date)
    setStartAddress(trip.start_address)
    setEndAddress(trip.end_address)
    setMiles(String(trip.miles))
    setPurpose(trip.purpose || '')
    setIsRoundTrip(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function deleteTrip(id: number) {
    const confirmed = window.confirm('Delete this trip? This cannot be undone.')
    if (!confirmed) return

    const { error } = await supabase.from('trips').delete().eq('id', id)
    if (error) {
      console.error(error)
      alert('Error deleting trip')
    } else {
      fetchTrips()
    }
  }

  function getFilteredTrips() {
    return trips.filter((t) => t.date?.startsWith(selectedMonth))
  }

  function exportCSV() {
    const filtered = getFilteredTrips()
    const headers = ['Date', 'From', 'To', 'Miles', 'Purpose']
    const rows = filtered.map((t) => [t.date, t.start_address, t.end_address, t.miles, t.purpose || ''])
    const csvContent = [headers, ...rows]
      .map((row) => row.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `mileage-report-${selectedMonth}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const inputClass =
    'w-full rounded-md border border-slate-300 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4C1D95] focus:border-transparent'

  return (
    <LoadScript
      googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}
      libraries={libraries}
    >
      <div className="min-h-screen bg-[#F8F7FC]">
       <header className="bg-[#4C1D95] text-white shadow-md">
  <div className="max-w-2xl mx-auto px-6 py-4 grid grid-cols-3 items-center">
    <div>
      <h1 className="text-lg font-semibold leading-tight">Mileage Tracker</h1>
      <p className="text-xs text-purple-200">Re Vera Services</p>
    </div>
    <div className="flex justify-center">
      <Image src="/logo.png" alt="Re Vera Services" width={300} height={120} className="rounded-md bg-white p-2" />
    </div>
    <div></div>
  </div>
</header>

        <main className="max-w-2xl mx-auto p-4 space-y-6">
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-5 space-y-3">
            {editingId !== null && (
              <div className="flex items-center justify-between bg-purple-50 border border-purple-200 text-purple-900 text-sm rounded-md px-3 py-2">
                <span>Editing trip</span>
                <button type="button" onClick={resetForm} className="underline">Cancel</button>
              </div>
            )}

            <div>
  <label className="block text-sm text-slate-600 mb-1">Date</label>
  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputClass} />
</div>

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
                className={inputClass}
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
                className={inputClass}
              />
            </Autocomplete>

            <div className="flex flex-wrap gap-2">
              {getRecentPlaces().map((place) => (
                <button
                  key={place}
                  type="button"
                  onClick={() => {
                    setEndAddress(place)
                    calculateDistance(startAddress, place)
                  }}
                  className="text-xs bg-purple-100 text-purple-800 rounded-full px-3 py-1 hover:bg-purple-200 transition"
                >
                  {place.split(',')[0]}
                </button>
              ))}
            </div>

            <input
              type="number"
              step="0.1"
              placeholder="Miles"
              value={miles}
              onChange={(e) => setMiles(e.target.value)}
              required
              className={inputClass}
            />
            <input
              type="text"
              placeholder="Purpose"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className={inputClass}
            />

            {editingId === null && (
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={isRoundTrip}
                  onChange={(e) => setIsRoundTrip(e.target.checked)}
                  className="accent-[#4C1D95]"
                />
                Return to start address? (logs the trip back too, same mileage)
              </label>
            )}

            <button
              type="submit"
              className="w-full bg-[#3B0764] hover:bg-[#2e0552] transition text-white font-medium rounded-md py-2"
            >
              {editingId !== null ? 'Save Changes' : 'Add Trip'}
            </button>
          </form>

          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-semibold text-slate-800">Trips</h2>
              <div className="flex items-center gap-2">
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                />
                <button
                  onClick={exportCSV}
                  type="button"
                  className="bg-[#3B0764] hover:bg-[#2e0552] transition text-white text-sm font-medium rounded-md px-3 py-1.5"
                >
                  Export CSV
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-purple-50 text-purple-900">
                    <th className="text-left px-2 py-2 rounded-l-md">Date</th>
                    <th className="text-left px-2 py-2">From</th>
                    <th className="text-left px-2 py-2">To</th>
                    <th className="text-left px-2 py-2">Miles</th>
                    <th className="text-left px-2 py-2">Purpose</th>
                    <th className="rounded-r-md"></th>
                  </tr>
                </thead>
                <tbody>
                  {trips.map((trip) => (
                    <tr key={trip.id} className="border-b border-slate-100">
                      <td className="px-2 py-2 whitespace-nowrap">{trip.date}</td>
                      <td className="px-2 py-2">{trip.start_address}</td>
                      <td className="px-2 py-2">{trip.end_address}</td>
                      <td className="px-2 py-2">{trip.miles}</td>
                      <td className="px-2 py-2">{trip.purpose}</td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => startEdit(trip)}
                          className="text-purple-700 text-xs underline mr-2"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteTrip(trip.id)}
                          className="text-red-600 text-xs underline"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </LoadScript>
  )
}