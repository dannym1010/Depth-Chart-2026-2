// Favorites and playlists. The list lives in the Film Room's library column (next to the games); the play on
// screen is starred or added to a playlist from the bar under the video (PlayListActions).
import React, { useEffect, useRef, useState } from 'react';
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

type Update = (change: (l: FilmLists) => FilmLists) => void;

const btn = 'inline-flex items-center gap-1 h-7 px-2 rounded-lg text-[11px] font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
const soft = `${btn} bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700`;
const primary = `${btn} bg-indigo-600 text-white hover:bg-indigo-500`;
const icon = 'p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-slate-800 cursor-pointer disabled:opacity-30';
const field = 'flex-1 min-w-0 h-7 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-1.5 text-xs text-slate-900 dark:text-slate-100';

/**
 * Put one or more plays in a playlist: one of yours (plays already in it are skipped), or a new one named here.
 * Calls onDone with the playlist's name.
 */
export const AddToPlaylistMenu: React.FC<{
  refs: ClipRef[];
  lists: FilmLists;
  update: Update;
  me: string;
  myName: string;
  onDone: (listName: string, added: number) => void;
}> = ({ refs, lists, update, me, myName, onDone }) => {
  const [name, setName] = useState('');
  const owned = playlistsFor(lists, me).filter((l) => isOwner(l, me));
  const missing = (items: { gameKey: string; playId: string }[]) => refs.filter((r) => !items.some((i) => i.gameKey === r.gameKey && i.playId === r.playId));
  const create = () => {
    const list = refs.reduce((l, r) => addToPlaylist(l, r), newPlaylist(name || `Playlist ${owned.length + 1}`, me, myName));
    update((l) => ({ ...l, playlists: [...l.playlists, list] }));
    onDone(list.name, refs.length);
  };
  return (
    <div className="space-y-1 text-slate-800 dark:text-slate-100">
      {owned.map((l) => {
        const add = missing(l.items);
        return (
          <button
            key={l.id}
            type="button"
            disabled={!add.length}
            onClick={() => {
              update((all) => editPlaylist(all, l.id, (x) => add.reduce((y, r) => addToPlaylist(y, r), x)));
              onDone(l.name, add.length);
            }}
            className="w-full text-left px-2 py-1 rounded-md text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer disabled:cursor-default"
          >
            {l.name}{' '}
            <span className="text-slate-400">
              ({l.items.length}
              {!add.length ? ', already in it' : add.length < refs.length ? `, ${refs.length - add.length} already in it` : ''})
            </span>
          </button>
        );
      })}
      <div className="flex gap-1">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && create()}
          placeholder="New playlist name"
          aria-label="New playlist name"
          className={field}
        />
        <button type="button" onClick={create} className={primary}>
          New playlist
        </button>
      </div>
    </div>
  );
};

/** The play on screen: a star, and Add to playlist (a small menu). For the bar under the video. */
export const PlayListActions: React.FC<{ current: ClipRef; lists: FilmLists; update: Update; me: string; myName: string }> = ({ current, lists, update, me, myName }) => {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const starred = isFavorite(lists, me, current);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  useEffect(() => {
    if (!note) return;
    const t = window.setTimeout(() => setNote(''), 2500);
    return () => window.clearTimeout(t);
  }, [note]);
  return (
    <div ref={box} className="relative inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => update((l) => toggleFavorite(l, me, current))}
        aria-pressed={starred}
        title={starred ? 'In your favorites (click to take it out)' : 'Add this play to your favorites'}
        className={`${btn} ${starred ? 'bg-amber-400 text-amber-950 hover:bg-amber-300' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200'}`}
      >
        <Star size={13} className={starred ? 'fill-current' : ''} /> <span className="hidden sm:inline">{starred ? 'Favorite' : 'Favorite'}</span>
      </button>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className={soft} title="Add this play to a playlist">
        <ListPlus size={13} /> <span className="hidden sm:inline">Add to playlist</span>
      </button>
      {note && <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{note}</span>}
      {open && (
        <div className="absolute left-0 top-full mt-1 z-40 w-64 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-2">
          <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400 truncate" title={current.label}>
            Add {current.label}
          </div>
          <AddToPlaylistMenu
            refs={[current]}
            lists={lists}
            update={update}
            me={me}
            myName={myName}
            onDone={(name, n) => {
              setOpen(false);
              setNote(n ? `Added to ${name}` : `Already in ${name}`);
            }}
          />
        </div>
      )}
    </div>
  );
};

interface Props {
  lists: FilmLists;
  update: Update;
  /** Who's signed in (email) and their name. */
  me: string;
  myName: string;
  /** People a playlist can be shared with (the staff, players and families with this team). */
  people: Person[];
  /** Watching only: lists shared with them can be played, nothing changed. */
  readOnly?: boolean;
  /** Watch one play; `list` is the playlist (or favorites) it's played from, to step through. */
  onWatch: (item: ClipRef, list?: { id: string; name: string; items: ClipRef[]; index: number }) => void;
  /** The playlist being played (its id, or "fav"), and which play. */
  playing?: { id: string; index: number } | null;
}

/** Favorites and playlists (in the library column). */
export const PlaylistsPanel: React.FC<Props> = ({ lists, update, me, myName, people, readOnly, onWatch, playing }) => {
  const [open, setOpen] = useState<string | null>('fav');
  const [sharing, setSharing] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  // Favorites checked to put in a playlist.
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const favs = favoritesOf(lists, me);
  const mine = playlistsFor(lists, me);
  const owned = mine.filter((l) => isOwner(l, me));
  const nameOf = (email: string) => people.find((p) => p.email.toLowerCase() === email.toLowerCase())?.name || email.split('@')[0];
  const chosen = favs.filter((f) => picked.has(f.id));
  const togglePick = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const create = () => {
    const list = newPlaylist(newName || `Playlist ${owned.length + 1}`, me, myName);
    update((l) => ({ ...l, playlists: [...l.playlists, list] }));
    setNewName('');
    setOpen(list.id);
  };

  return (
    <div className="p-2.5 space-y-3 text-slate-800 dark:text-slate-100">
      {/* Favorites: watch them, or check some and put them in a playlist */}
      <section className="rounded-lg border border-amber-200 dark:border-amber-500/30">
        <div className="flex items-center gap-1.5 px-2 py-1.5">
          <button type="button" onClick={() => setOpen(open === 'fav' ? null : 'fav')} className="flex-1 flex items-center gap-1.5 text-left cursor-pointer" aria-expanded={open === 'fav'}>
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
          <div className="border-t border-amber-200 dark:border-amber-500/30 px-1.5 py-1.5 space-y-1">
            {!favs.length && <p className="px-1 text-[11px] text-slate-400">Star a play: ☆ in the play list, or Favorite under the video.</p>}
            {favs.length > 0 && !readOnly && (
              <label className="flex items-center gap-1.5 px-1 text-[11px] font-bold text-slate-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={chosen.length === favs.length}
                  ref={(el) => {
                    if (el) el.indeterminate = chosen.length > 0 && chosen.length < favs.length;
                  }}
                  onChange={(e) => setPicked(e.target.checked ? new Set(favs.map((f) => f.id)) : new Set())}
                />
                Select all, to put in a playlist
              </label>
            )}
            <ul className="space-y-0.5">
              {favs.map((f, i) => (
                <li key={f.id} className={`flex items-center gap-1 rounded-md ${playing?.id === 'fav' && playing.index === i ? 'bg-indigo-50 dark:bg-indigo-500/15' : ''}`}>
                  {!readOnly && <input type="checkbox" checked={picked.has(f.id)} onChange={() => togglePick(f.id)} aria-label={`Pick ${f.label}`} className="ml-1 shrink-0" />}
                  <button type="button" onClick={() => onWatch(f, { id: 'fav', name: 'My favorites', items: favs, index: i })} className="flex-1 min-w-0 text-left px-1 py-1 text-xs truncate hover:underline cursor-pointer" title={f.label}>
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
            {chosen.length > 0 && !readOnly && (
              <div className="rounded-md bg-slate-50 dark:bg-slate-800/60 p-1.5">
                <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Put {chosen.length} favorite{chosen.length === 1 ? '' : 's'} in
                </div>
                <AddToPlaylistMenu
                  refs={chosen}
                  lists={lists}
                  update={update}
                  me={me}
                  myName={myName}
                  onDone={(name, n) => {
                    setPicked(new Set());
                    setNote(n ? `Added ${n} to ${name}` : `Already in ${name}`);
                    const made = playlistsFor(lists, me).find((l) => l.name === name);
                    if (made) setOpen(made.id);
                  }}
                />
              </div>
            )}
            {note && <p className="px-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">{note}</p>}
          </div>
        )}
      </section>

      {/* Playlists */}
      <section className="space-y-1.5">
        <div className="text-xs font-black px-0.5">Playlists ({mine.length})</div>
        {!readOnly && (
          <div className="flex gap-1">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} placeholder="Name a new playlist" aria-label="Name a new playlist" className={field} />
            <button type="button" onClick={create} className={primary}>
              Create
            </button>
          </div>
        )}
        {!mine.length && <p className="text-[11px] text-slate-400 px-0.5">No playlists yet{readOnly ? ' shared with you' : ''}.</p>}
        <ul className="space-y-1.5">
          {mine.map((l) => {
            const mineToEdit = isOwner(l, me) && !readOnly;
            const isOpen = open === l.id;
            const everyone = l.sharedWith.includes(EVERYONE);
            const shareText = everyone ? 'everyone' : l.sharedWith.length ? `${l.sharedWith.length} ${l.sharedWith.length === 1 ? 'person' : 'people'}` : '';
            return (
              <li key={l.id} className={`rounded-lg border ${playing?.id === l.id ? 'border-indigo-400 dark:border-indigo-500' : 'border-slate-200 dark:border-slate-700'}`}>
                <div className="flex items-center gap-1 px-2 py-1.5">
                  {renaming?.id === l.id ? (
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
                      className={`${field} font-bold`}
                    />
                  ) : (
                    <button type="button" onClick={() => setOpen(isOpen ? null : l.id)} aria-expanded={isOpen} className="flex-1 min-w-0 text-left cursor-pointer">
                      <span className="block text-xs font-black truncate">{l.name}</span>
                      <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        {l.items.length} play{l.items.length === 1 ? '' : 's'}
                        {isOwner(l, me) ? (shareText ? ` · shared with ${shareText}` : ' · only you') : ` · from ${l.ownerName || nameOf(l.owner)}`}
                      </span>
                    </button>
                  )}
                  <button type="button" disabled={!l.items.length} onClick={() => onWatch(l.items[0], { id: l.id, name: l.name, items: l.items, index: 0 })} className={soft} title="Play this list in order">
                    <PlayIcon size={12} /> Play
                  </button>
                </div>
                {mineToEdit && isOpen && (
                  <div className="flex items-center gap-0.5 px-1.5 pb-1">
                    <button type="button" onClick={() => setSharing(sharing === l.id ? null : l.id)} className={`${icon} inline-flex items-center gap-1 text-[11px] font-bold`} title="Share with people">
                      <Share2 size={13} /> Share
                    </button>
                    <button type="button" onClick={() => setRenaming({ id: l.id, name: l.name })} className={`${icon} inline-flex items-center gap-1 text-[11px] font-bold`} title="Rename">
                      <Pencil size={12} /> Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => window.confirm(`Delete the playlist "${l.name}"? The film and plays stay.`) && update((all) => removePlaylist(all, l.id))}
                      className={`${icon} inline-flex items-center gap-1 text-[11px] font-bold hover:text-rose-600`}
                      title="Delete"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                )}

                {/* Who it's shared with */}
                {sharing === l.id && mineToEdit && isOpen && (
                  <div className="border-t border-slate-200 dark:border-slate-700 px-2 py-1.5 space-y-1">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Share with</div>
                    <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer">
                      <input type="checkbox" checked={everyone} onChange={(e) => update((all) => editPlaylist(all, l.id, (x) => ({ ...x, sharedWith: e.target.checked ? [EVERYONE] : [] })))} />
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
                    <p className="text-[10px] text-slate-400">They see it under Playlists and can play it; only you can change it.</p>
                  </div>
                )}

                {/* Its plays */}
                {isOpen && (
                  <ol className="border-t border-slate-200 dark:border-slate-700 px-1 py-1 space-y-0.5">
                    {!l.items.length && <li className="px-1 text-[11px] text-slate-400">Empty. Add the play on screen (Add to playlist under the video) or put favorites in it.</li>}
                    {l.items.map((it, i) => (
                      <li key={it.id} className={`flex items-center gap-0.5 rounded-md ${playing?.id === l.id && playing.index === i ? 'bg-indigo-50 dark:bg-indigo-500/15' : ''}`}>
                        <span className="w-5 text-right text-[10px] font-bold text-slate-400 shrink-0">{i + 1}.</span>
                        <button type="button" onClick={() => onWatch(it, { id: l.id, name: l.name, items: l.items, index: i })} className="flex-1 min-w-0 text-left px-1 py-1 text-xs truncate hover:underline cursor-pointer" title={it.label}>
                          {it.label}
                        </button>
                        {mineToEdit && (
                          <>
                            <button type="button" disabled={i === 0} onClick={() => update((all) => editPlaylist(all, l.id, (x) => moveItem(x, i, i - 1)))} className={icon} aria-label="Move up">
                              <ArrowUp size={12} />
                            </button>
                            <button type="button" disabled={i === l.items.length - 1} onClick={() => update((all) => editPlaylist(all, l.id, (x) => moveItem(x, i, i + 1)))} className={icon} aria-label="Move down">
                              <ArrowDown size={12} />
                            </button>
                            <button type="button" onClick={() => update((all) => editPlaylist(all, l.id, (x) => ({ ...x, items: x.items.filter((y) => y.id !== it.id) })))} className={`${icon} hover:text-rose-600`} aria-label={`Take ${it.label} out`}>
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
