import { NextResponse } from 'next/server';

// In-memory store for active peers (Note: This is ephemeral in serverless)
// We use a global variable to persist across warm lambda invocations
declare global {
  var activePeers: Map<string, { id: string; ip: string; lastSeen: number }>;
}

if (!global.activePeers) {
  global.activePeers = new Map();
}

export async function POST(request: Request) {
  try {
    const { id } = await request.json();
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    
    // Register or update peer
    global.activePeers.set(id, { id, ip, lastSeen: Date.now() });
    
    // Clean up stale peers (older than 30 seconds)
    const now = Date.now();
    for (const [peerId, data] of global.activePeers.entries()) {
      if (now - data.lastSeen > 30000) {
        global.activePeers.delete(peerId);
      }
    }

    // Return list of other peers on the same IP
    const peers = Array.from(global.activePeers.values())
      .filter(p => p.id !== id && (p.ip === ip || ip === 'unknown'))
      .map(p => ({ id: p.id, name: `Device ${p.id.slice(0, 4)}` }));

    return NextResponse.json({ peers });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to register' }, { status: 500 });
  }
}
