import React from 'react';
import { HomeClient } from './home-client';
import styles from './page.module.css';

export default function Home() {
  return (
    <div className={styles.container}>
      <HomeClient />
    </div>
  );
}
