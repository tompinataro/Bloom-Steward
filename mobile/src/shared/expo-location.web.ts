export const Accuracy = {
  Highest: 6,
};

export async function geocodeAsync(_address: string) {
  return [];
}

export async function getForegroundPermissionsAsync() {
  return { status: 'granted' };
}

export async function requestForegroundPermissionsAsync() {
  return { status: 'granted' };
}

export async function getCurrentPositionAsync() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not available in this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
        });
      },
      () => reject(new Error('Unable to read current location.')),
      { enableHighAccuracy: true },
    );
  });
}
