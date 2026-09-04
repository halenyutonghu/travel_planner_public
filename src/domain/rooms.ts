export function defaultRoomOccupancy(people: number): number[] {
  const rooms: number[] = [];
  let remaining = people;
  while (remaining > 0) {
    const occupants = Math.min(2, remaining);
    rooms.push(occupants);
    remaining -= occupants;
  }
  return rooms;
}

export function roomsAreValid(occupancy: number[], people: number): boolean {
  return occupancy.length >= 1 && occupancy.every((count) => Number.isInteger(count) && count >= 1 && count <= 6) && occupancy.reduce((sum, count) => sum + count, 0) === people;
}
