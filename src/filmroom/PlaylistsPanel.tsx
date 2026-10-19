// Beside the video: this coach's favorite plays, and the playlists they made or that were shared with them.
// The play on screen can be starred or added to a playlist; a playlist plays through its plays in order.
import React, { useState } from 'react';
import { ArrowDown, ArrowUp, ListPlus, Pencil, Play as PlayIcon, Share2, Star, Trash2, X } from 'lucide-react';
import {
  EVERYONE,
  addToPlaylist,
  editPlaylist,
  favoritesOf,
  isFavorite,
  isOwner,
  moveItem,
  newPlaylist,
  playlistsFor,
  removePlaylist,
  toggleFavorite,
  type ClipRef,
  type FilmLists,
} from './playlists';

export interface Person {
  email: string;
  name: string;
  role?: string;
}

interface Props {
  lists: FilmLists;
  update: (change: (l: FilmLists) => FilmLists) => void;
  /** Who's signed in (email) and their name. */
  me: string;
  myName: string;
  /** People a playlist can be shared with (the staff, players and families with this team). */
  people: Person[];
  /** The play on screen. */
  current?: ClipRef;
  /** Watching only: lists shared with them can be played, nothing changed. */
  readOnly?: boolean;
  /** Watch one play; `list` is the playlist (or favorites) it's played from, to step through. */
  onWatch: (item: ClipRef, list?: { id: string; name: string; items: ClipRef[]; index: number }) => void;
  /** The playlist being played (its id, or "fav"), and which play. */
  playing?: { id: string; index: number } | null;
}

const btn = 'inline-flex items-center gap-1 h-7 px-2 rounded-lg text-[11px] font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
const soft = `${btn} bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700`;
const icon = 'p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-slate-800 cursor-pointer disabled:opacity-30';

export const PlaylistsPanel: React.FC<Props> = ({ lists, update, me, myName, people, current, readOnly, onWatch, playing }) => {
  const [open, setOpen] = useState<string | null>(null);
  const [sharing, setSharing] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const favs = favoritesOf(lists, me);
  const mine = playlistsFor(lists, me);
  const owned = mine.filter((l) => isOwner(l, me));
  const starred = Boolean(current && isFavorite(lists, me, current));
  const nameOf = (email: string) => people.find((p) => p.email.toLowerCase() === email.toLowerCase())?.name || email.split('@')[0];

  const create = (andAdd: boolean) => {
    const list = newPlaylist(newName || `Playlist ${owned.length + 1}`, me, myName);
    const withPlay = andAdd && current ? addToPlaylist(list, current) : list;
    update((l) => ({ ...l, playlists: [...l.playlists, withPlay] }));
    setNewName('');
    setOpen(list.id);
    setAddOpen(false);
  };

  return (
    <div className="p-3 space-y-3 text-slate-800 dark:text-slate-100">
      {/* The play on screen */}
      {current && !readOnly && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 space-y-1.5">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">This play</div>
          <div className="text-xs font-bold truncate" title={current.label}>
            {current.label}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => update((l) => toggleFavorite(l, me, current))}
              aria-pressed={starred}
              className={`${btn} ${starred ? 'bg-amber-400 text-amber-950 hover:bg-amber-300' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200'}`}
            >
              <Star size={13} className={starred ? 'fill-current' : ''} /> {starred ? 'Favorite' : 'Add to favorites'}
            </button>
            <button type="button" onClick={() => setAddOpen((v) => !v)} aria-expanded={addOpen} className={soft}>
              <ListPlus size={13} /> Add to playlist
            </button>
          </div>
          {addOpen && (
            <div className="space-y-1">
              {owned.map((l) => {
                const has = l.items.some((i) => i.gameKey === current.gameKey && i.playId === current.playId);
                return (
                  <button
                    key={l.id}
                    type="button"
                    disabled={has}
                    onClick={() => {
                      update((all) => editPlaylist(all, l.id, (x) => addToPlaylist(x, current)));
                      setAddOpen(false);
                    }}
                    className="w-full text-left px-2 py-1 rounded-md text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                  >
                    {l.name} <span className="text-slate-400">({l.items.length}{has ? ', already in it' : ''})</span>
                  </button>
                );
              })}
              <div className="flex gap-1">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && create(true)}
                  placeholder="New playlist name"
                  aria-label="New playlist name"
                  className="flex-1 min-w-0 h-7 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-1.5 text-xs"
                />
                <button type="button" onClick={() => create(true)} className={`${btn} bg-indigo-600 text-white hover:bg-indigo-500`}>
                  New + add
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Favorites */}
      <section>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => setOpen(open === 'fav' ? null : 'fav')} className="flex-1 flex items-center gap-1.5 text-left" aria-expanded={open === 'fav'}>
            <Star size={14} className="text-amber-500 fill-current" />
            <span className="text-xs font-black">My favorites ({favs.length})</span>
          </button>
          {favs.length > 0 && (
            <button type="button" onClick={() => onWatch(favs[0], { id: 'fav', name: 'My favorites', items: favs, index: 0 })} className={soft} title="Play your favorites in order">
              <PlayIcon size={12} /> Play
            </button>
          )}
        </div>
        {open === 'fav' && (
          <ul className="mt-1 space-y-0.5">
            {!favs.length && <li className="text-[11px] text-slate-400">Star a play (☆ in the play list, or Add to favorites above).</li>}
            {favs.map((f, i) => (
              <li key={f.id} className={`flex items-center gap-1 rounded-md ${playing?.id === 'fav' && playing.index === i ? 'bg-indigo-50 dark:bg-indigo-500/15' : ''}`}>
                <button type="button" onClick={() => onWatch(f, { id: 'fav', name: 'My favorites', items: favs, index: i })} className="flex-1 min-w-0 text-left px-1.5 py-1 text-xs truncate hover:underline" title={f.label}>
                  {f.label}
                </button>
                {!readOnly && (
                  <button type="button" onClick={() => update((l) => toggleFavorite(l, me, f))} className={icon} aria-label={`Take ${f.label} out of favorites`}>
                    <X size={13} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Playlists */}
      <section className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-black flex-1">Playlists ({mine.length})</span>
        </div>
        {!readOnly && (
          <div className="flex gap-1">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && create(false)}
              placeholder="Name a new playlist"
              aria-label="Name a new playlist"
              className="flex-1 min-w-0 h-7 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-1.5 text-xs"
            />
            <button type="button" onClick={() => create(false)} className={`${btn} bg-indigo-600 text-white hover:bg-indigo-500`}>
              Create
            </button>
          </div>
        )}
        {!mine.length && <p className="text-[11px] text-slate-400">No playlists yet{readOnly ? ' shared with you' : ''}.</p>}
        <ul className="space-y-1.5">
          {mine.map((l) => {
            const mineToEdit = isOwner(l, me) && !readOnly;
            const isOpen = open === l.id;
            const everyone = l.sharedWith.includes(EVERYONE);
            const shareText = everyone ? 'everyone' : l.sharedWith.length ? `${l.sharedWith.length} ${l.sharedWith.length === 1 ? 'person' : 'people'}` : '';
            return (
              <li key={l.id} className="rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-1 px-2 py-1.5">
                  <button type="button" onClick={() => setOpen(isOpen ? null : l.id)} aria-expanded={isOpen} className="flex-1 min-w-0 text-left">
                    {renaming?.id === l.id ? null : (
                      <>
                        <span className="block text-xs font-black truncate">{l.name}</span>
                        <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          {l.items.length} play{l.items.length === 1 ? '' : 's'}
                          {isOwner(l, me) ? (shareText ? ` · shared with ${shareText}` : ' · only you') : ` · from ${l.ownerName || nameOf(l.owner)}`}
                        </span>
                      </>
                    )}
                  </button>
                  {renaming?.id === l.id && (
                    <input
                      autoFocus
                      value={renaming.name}
                      onChange={(e) => setRenaming({ id: l.id, name: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        if (e.key === 'Escape') setRenaming(null);
                      }}
                      onBlur={() => {
                        const name = renaming.name.trim();
                        if (name && name !== l.name) update((all) => editPlaylist(all, l.id, (x) => ({ ...x, name })));
                        setRenaming(null);
                      }}
                      aria-label="Playlist name"
                      className="flex-1 min-w-0 h-7 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-1.5 text-xs font-bold"
                    />
                  )}
                  <button
                    type="button"
                    disabled={!l.items.length}
                    onClick={() => onWatch(l.items[0], { id: l.id, name: l.name, items: l.items, index: 0 })}
                    className={soft}
                    title="Play this list in order"
                  >
                    <PlayIcon size={12} /> Play
                  </button>
                  {mineToEdit && (
                    <>
                      <button type="button" onClick={() => setSharing(sharing === l.id ? null : l.id)} className={icon} aria-label={`Share ${l.name}`} title="Share with people">
                        <Share2 size={14} />
                      </button>
                      <button type="button" onClick={() => setRenaming({ id: l.id, name: l.name })} className={icon} aria-label={`Rename ${l.name}`} title="Rename">
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => window.confirm(`Delete the playlist "${l.name}"? The film and plays stay.`) && update((all) => removePlaylist(all, l.id))}
                        className={`${icon} hover:text-rose-600`}
                        aria-label={`Delete ${l.name}`}
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>

                {/* Who it's shared with */}
                {sharing === l.id && mineToEdit && (
                  <div className="border-t border-slate-200 dark:border-slate-700 px-2 py-1.5 space-y-1">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Share with</div>
                    <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={everyone}
                        onChange={(e) =>
                          update((all) => editPlaylist(all, l.id, (x) => ({ ...x, sharedWith: e.target.checked ? [EVERYONE] : [] })))
                        }
                      />
                      Everyone with this team
                    </label>
                    {!everyone && (
                      <ul className="max-h-48 overflow-y-auto space-y-0.5">
                        {people
                          .filter((p) => p.email.toLowerCase() !== me.toLowerCase())
                          .map((p) => {
                            const on = l.sharedWith.some((e) => e.toLowerCase() === p.email.toLowerCase());
                            return (
                              <li key={p.email}>
                                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={on}
                                    onChange={() =>
                                      update((all) =>
                                        editPlaylist(all, l.id, (x) => ({
                                          ...x,
                                          sharedWith: on ? x.sharedWith.filter((e) => e.toLowerCase() !== p.email.toLowerCase()) : [...x.sharedWith, p.email.toLowerCase()],
                                        }))
                                      )
                                    }
                                  />
                                  <span className="font-semibold truncate">{p.name}</span>
                                  {p.role && <span className="text-[10px] text-slate-400 shrink-0">{p.role}</span>}
                                </label>
                              </li>
                            );
                          })}
                      </ul>
                    )}
                    <p className="text-[10px] text-slate-400">They see it in their Playlists and can play it; only you can change it.</p>
                  </div>
                )}

                {/* Its plays */}
                {isOpen && (
                  <ol className="border-t border-slate-200 dark:border-slate-700 px-1 py-1 space-y-0.5">
                    {!l.items.length && <li className="px-1 text-[11px] text-slate-400">Empty. Open a play and use Add to playlist.</li>}
                    {l.items.map((it, i) => (
                      <li key={it.id} className={`flex items-center gap-0.5 rounded-md ${playing?.id === l.id && playing.index === i ? 'bg-indigo-50 dark:bg-indigo-500/15' : ''}`}>
                        <span className="w-5 text-right text-[10px] font-bold text-slate-400 shrink-0">{i + 1}.</span>
                        <button
                          type="button"
                          onClick={() => onWatch(it, { id: l.id, name: l.name, items: l.items, index: i })}
                          className="flex-1 min-w-0 text-left px-1 py-1 text-xs truncate hover:underline"
                          title={it.label}
                        >
                          {it.label}
                        </button>
                        {mineToEdit && (
                          <>
                            <button type="button" disabled={i === 0} onClick={() => update((all) => editPlaylist(all, l.id, (x) => moveItem(x, i, i - 1)))} className={icon} aria-label="Move up">
                              <ArrowUp size={12} />
                            </button>
                            <button
                              type="button"
                              disabled={i === l.items.length - 1}
                              onClick={() => update((all) => editPlaylist(all, l.id, (x) => moveItem(x, i, i + 1)))}
                              className={icon}
                              aria-label="Move down"
                            >
                              <ArrowDown size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => update((all) => editPlaylist(all, l.id, (x) => ({ ...x, items: x.items.filter((y) => y.id !== it.id) })))}
                              className={`${icon} hover:text-rose-600`}
                              aria-label={`Take ${it.label} out`}
                            >
                              <X size={12} />
                            </button>
                          </>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
};
