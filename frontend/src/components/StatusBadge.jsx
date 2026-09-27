import React from 'react';

export default function StatusBadge({ status }) {
  if (!status) return null;

  const normalized = status.toUpperCase();
  let badgeClass = 'badge-draft';

  switch (normalized) {
    case 'NEW':
      badgeClass = 'badge-new';
      break;
    case 'QUOTED':
      badgeClass = 'badge-quoted';
      break;
    case 'SENT':
      badgeClass = 'badge-sent';
      break;
    case 'ACCEPTED':
    case 'WON':
      badgeClass = 'badge-accepted';
      break;
    case 'REJECTED':
    case 'LOST':
    case 'CANCELLED':
      badgeClass = 'badge-rejected';
      break;
    case 'PENDING':
      badgeClass = 'badge-pending';
      break;
    case 'CONFIRMED':
      badgeClass = 'badge-confirmed';
      break;
    case 'DISPATCHED':
      badgeClass = 'badge-dispatched';
      break;
    default:
      badgeClass = 'badge-draft';
  }

  return <span className={`badge ${badgeClass}`}>{normalized}</span>;
}
