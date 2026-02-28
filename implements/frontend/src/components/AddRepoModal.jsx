import React, { useState } from 'react';

const AddRepoModal = ({ onClose, onSubmit }) => {
    const [name, setName] = useState('');
    const [path, setPath] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (name && path) {
            onSubmit(name, path);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal">
                <h2>Add Git Repository</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Repository Name (Alias)</label>
                        <input
                            type="text"
                            className="form-control"
                            placeholder="e.g. Android Framework"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Absolute Local Path</label>
                        <input
                            type="text"
                            className="form-control"
                            placeholder="/Users/name/projects/repo"
                            value={path}
                            onChange={e => setPath(e.target.value)}
                            required
                        />
                    </div>

                    <div className="modal-actions">
                        <button type="button" className="btn btn-cancel" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary">
                            Add & Start Scan
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddRepoModal;
