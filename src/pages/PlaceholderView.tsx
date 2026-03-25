import React from 'react';

export default function PlaceholderView({ title, description }: { title: string, description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
      <div className="w-16 h-16 bg-surface-container-high rounded-full flex items-center justify-center mb-4">
        <span className="text-2xl font-bold text-on-surface-variant">{title[0]}</span>
      </div>
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="text-on-surface-variant max-w-md">
        {description || `The ${title} module is currently under development. Check back soon for updates!`}
      </p>
    </div>
  );
}
