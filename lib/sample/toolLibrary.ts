import type { MapReply } from '@/engine/types';
import { fromBranches } from '@/lib/ids';

export const SAMPLE_BRANCHES: MapReply = {
  title: 'Tool Library',
  summary: 'A neighborhood library where people borrow drills, ladders and sewing machines instead of books.',
  branches: [
    { name: 'Idle ownership', kind: 'Problem', note: 'Most household tools are used for only a few hours in their lifetime.', children: [{ name: 'Garage clutter', note: '' }, { name: 'Cost of one-off jobs', note: '' }, { name: 'Duplicate purchases', note: '' }] },
    { name: 'Renters & first homes', kind: 'People', note: 'People with small spaces and occasional repair needs.', children: [{ name: 'Apartment renters', note: '' }, { name: 'DIY beginners', note: '' }, { name: 'Makers on a budget', note: '' }] },
    { name: 'Membership lending', kind: 'Mechanism', note: 'Annual membership, an online catalog and one-week loans.', children: [{ name: 'Barcode checkout', note: '' }, { name: 'Deposit system', note: '' }, { name: 'Pickup lockers', note: '' }] },
    { name: 'Skills, not just stuff', kind: 'Value', note: 'Workshops turn borrowing into learning.', children: [{ name: 'Repair cafés', note: '' }, { name: 'Weekend classes', note: '' }] },
    { name: 'Damage & loss', kind: 'Risk', note: 'Tools come back broken, or not at all.', children: [{ name: 'Insurance pool', note: '' }, { name: 'Condition checks', note: '' }, { name: 'Late fees', note: '' }] },
    { name: 'Pilot shelf', kind: 'Next step', note: 'Start with 50 tools in one community center.', children: [{ name: 'Donation drive', note: '' }, { name: 'Partner library', note: '' }, { name: 'Sign-up page', note: '' }] },
  ],
};

export const sampleBrain = (ink: string) => fromBranches(SAMPLE_BRANCHES, ink);
