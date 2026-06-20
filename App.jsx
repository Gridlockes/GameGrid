import React, { useState } from 'react';
import './App.css'; // Make sure to import the CSS file below

// Mock data for our games
const INITIAL_GAMES = [
  { id: 1, title: 'Neon Drift', genre: 'Racing', rating: 4.8, players: '12k', img: '🏎️' },
  { id: 2, title: 'Galactic Horizon', genre: 'RPG', rating: 4.9, players: '85k', img: '🌌' },
  { id: 3, title: 'Pixel Quest', genre: 'Platformer', rating: 4.5, players: '5k', img: '👾' },
  { id: 4, title: 'Cyber Ops', genre: 'Shooter', rating: 4.2, players: '22k', img: '🔫' },
  { id: 5, title: 'Blade & Sorcery', genre: 'Action', rating: 4.6, players: '18k', img: '⚔️' },
  { id: 6, title: 'Starcraft III', genre: 'Strategy', rating: 4.7, players: '40k', img: '🛸' },
];

export default function GameGrid() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');

  const genres = ['All', 'Racing', 'RPG', 'Platformer', 'Shooter', 'Action', 'Strategy'];

  // Filter games based on search and selected genre
  const filteredGames = INITIAL_GAMES.filter((game) => {
    const matchesSearch = game.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGenre = activeFilter === 'All' || game.genre === activeFilter;
    return matchesSearch && matchesGenre;
  });

  return (
    <div className="gamegrid-container">
      {/* Header */}
      <header className="header">
        <div className="logo">
          <span className="logo-icon">🎮</span>
          <h1>GameGrid</h1>
        </div>
        <input 
          type="text" 
          placeholder="Search games..." 
          className="search-bar"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </header>

      {/* Main Content */}
      <main className="main-content">
        <div className="hero">
          <h2>Welcome to the Grid</h2>
          <p>Your ultimate hub for the best indie and AAA titles.</p>
        </div>

        {/* Filters */}
        <div className="filters">
          {genres.map(genre => (
            <button 
              key={genre} 
              className={`filter-btn ${activeFilter === genre ? 'active' : ''}`}
              onClick={() => setActiveFilter(genre)}
            >
              {genre}
            </button>
          ))}
        </div>

        {/* The Grid */}
        <div className="grid">
          {filteredGames.length > 0 ? (
            filteredGames.map((game) => (
              <div key={game.id} className="game-card">
                <div className="game-image-placeholder">{game.img}</div>
                <div className="game-info">
                  <h3>{game.title}</h3>
                  <span className="genre-tag">{game.genre}</span>
                  <div className="stats">
                    <span className="rating">⭐ {game.rating}</span>
                    <span className="players">🟢 {game.players} online</span>
                  </div>
                  <button className="play-btn">Play Now</button>
                </div>
              </div>
            ))
          ) : (
            <div className="no-results">No games found in this sector.</div>
          )}
        </div>
      </main>
    </div>
  );
}
