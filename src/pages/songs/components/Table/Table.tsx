import { useWindowWidth } from '@/hooks'
import { breakpoints } from '@/utils'
import * as React from 'react'
import { useState } from 'react'
import { TableHead } from './TableHead'
import { Row, RowValue, TableProps } from './types'
import { sortBy } from './utils'

export default function Table<T extends Row>({
  columns,
  rows,
  search,
  onSelectRow,
  filter,
  getId,
}: TableProps<T>) {
  const [sortCol, setSortCol] = useState(1)
  const isSmall = useWindowWidth() < breakpoints.sm
  let rowHeight = 50

  if (isSmall) {
    columns = columns.filter((c) => c.keep)
  }

  const handleSelectCol = (index: number) => {
    if (sortCol === index) {
      setSortCol(-index)
    } else {
      setSortCol(index)
    }
  }

  const isSearchMatch = (s: RowValue = '') =>
    !search || String(s).toUpperCase().includes(search.toUpperCase())
  const filtered = !search ? rows : rows.filter((row) => filter.some((f) => isSearchMatch(row[f])))
  const sortField = columns[Math.abs(sortCol) - 1].id
  const sorted = sortBy<T>(
    (row) => {
      let field = row[sortField]
      if (typeof field === 'string' || typeof field === 'number') {
        return field
      }
      return 0
    },
    sortCol < 0,
    filtered,
  )
  const gridTemplateColumns = `repeat(${columns.length}, 1fr)`

  return (
    <div className="flex min-h-[300px] grow flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-[0_8px_32px_0_rgba(160,120,255,0.05)] backdrop-blur-xl">
      {/* Table Header Row */}
      <div className="grid border-b border-white/10 bg-white/5" style={{ gridTemplateColumns }}>
        <TableHead
          columns={columns}
          sortCol={sortCol}
          onSelectCol={handleSelectCol}
          rowHeight={rowHeight}
        />
      </div>

      {/* Scrollable Table Rows */}
      <div className="relative flex-1 overflow-y-auto">
        <div className="grid w-full content-start" style={{ gridTemplateColumns }}>
          {sorted.length === 0 && (
            <h2 className="col-span-full w-full p-8 text-center text-xl font-light text-[#cbc3d5]/60">
              No results
            </h2>
          )}
          {sorted.map((row: T, i) => {
            return (
              <div
                className="group contents cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation()
                  onSelectRow(getId(row))
                }}
                key={`row-${getId(row)}`}
              >
                {columns.map((col, j) => {
                  let cellValue = !!col.format ? col.format(row[col.id], row) : row[col.id]
                  const paddingLeft = j === 0 ? 24 : 12
                  return (
                    <span
                      className="relative flex shrink-0 items-center border-b border-white/5 px-4 text-sm font-light text-[#e7e0ec]/80 transition-all duration-200 group-hover:bg-[#a078ff]/10 group-hover:text-white"
                      key={`row-${i}-col-${j}`}
                      style={{ paddingLeft, height: rowHeight }}
                    >
                      {cellValue}
                    </span>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
