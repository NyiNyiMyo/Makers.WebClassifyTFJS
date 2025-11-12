import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  StatusBar,
  Image,
  TouchableOpacity,
  Platform,
} from 'react-native';

import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native'; // initialize native backend
import * as mobilenet from '@tensorflow-models/mobilenet';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decodeJpeg } from '@tensorflow/tfjs-react-native';
import { Buffer } from 'buffer';

class App extends React.Component {
  state = {
    isTfReady: false,
    isModelReady: false,
    predictions: null,
    image: null,
  };

  async componentDidMount() {
  try {
    console.log('Initializing TensorFlow...');
    await tf.ready();

    if (Platform.OS === 'android') {
      await tf.setBackend('cpu');   // force CPU backend on Android
      await tf.ready();
      console.log('Backend set to cpu');

      // Load lighter MobileNet on Android for speed
      this.model = await mobilenet.load({ version: 1, alpha: 0.25 });
      console.log('MobileNet light model loaded on Android');
    } else if (Platform.OS === 'ios') {
      await tf.setBackend('rn-webgl');
      await tf.ready();
      this.model = await mobilenet.load(); // default model for iOS
      console.log('Backend set to rn-webgl on iOS, MobileNet loaded');
    } else {
      await tf.setBackend('webgl');
      await tf.ready();
      this.model = await mobilenet.load(); // default for web
      console.log('Backend set to webgl on Web, MobileNet loaded');
    }

    this.setState({ isTfReady: true, isModelReady: true });
    this.getPermissionAsync();

  } catch (error) {
    console.error('TensorFlow initialization error:', error);
  }
}

  getPermissionAsync = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        alert('Camera roll permission is required!');
      }
    }
  };

  getFileUriFromContentUri = async (contentUri) => {
    const fileName = contentUri.split('/').pop();
    const fileUri = FileSystem.cacheDirectory + fileName;
    try {
      await FileSystem.copyAsync({ from: contentUri, to: fileUri });
      return fileUri;
    } catch (error) {
      console.error('Copy error:', error);
      throw error;
    }
  };

  imageToTensor = async (uri) => {
  const targetSize = Platform.OS === 'android' ? 96 : 224;  // smaller size for Android

  if (Platform.OS === 'web') {
    const img = document.createElement('img');
    img.crossOrigin = 'anonymous';
    img.src = uri;
    await new Promise((resolve) => (img.onload = resolve));
    return tf.browser
      .fromPixels(img)
      .resizeNearestNeighbor([targetSize, targetSize])
      .toFloat()
      .expandDims();
  } else {
    if (Platform.OS === 'android' && uri.startsWith('content://')) {
      uri = await this.getFileUriFromContentUri(uri);
    }

    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
    const raw = Buffer.from(base64, 'base64');
    const imageTensor = decodeJpeg(raw);

    const resized = imageTensor.resizeNearestNeighbor([targetSize, targetSize]).toFloat().expandDims();

    return resized;
  }
};

  selectImage = async () => {
    try {
      const mediaType =
        ImagePicker.MediaType?.Images ??
        ImagePicker.MediaTypeOptions?.Images ??
        'Images';

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: mediaType,
        allowsEditing: false,
        aspect: [4, 3],
        quality: 1,
      });

      if (result.canceled) return;

      const assets = result.assets ?? result.selected ?? [];
      if (!assets.length) return;

      let uri = assets[0]?.uri;
      if (!uri) {
        console.log('No URI found in selected image');
        return;
      }

      if (Platform.OS === 'android' && uri.startsWith('content://')) {
        uri = await this.getFileUriFromContentUri(uri);
        console.log('Selected image URI converted:', uri);
      } else {
        console.log('Selected image URI:', uri);
      }

      this.setState({ image: { uri }, predictions: null }, () => {
        this.classifyImage();
      });
    } catch (error) {
      console.error('Image selection error:', error);
    }
  };

  classifyImage = async () => {
    try {
      const { image } = this.state;
      if (!image || !image.uri) {
        console.log('No image selected');
        return;
      }

      const imageTensor = await this.imageToTensor(image.uri);
      const predictions = await this.model.classify(imageTensor);
      this.setState({ predictions });
      console.log('Predictions:', predictions);
    } catch (error) {
      console.error('Classification error:', error);
    }
  };

  renderPrediction = (prediction) => (
    <Text key={prediction.className} style={styles.text}>
      {prediction.className} - {Math.round(prediction.probability * 100)}%
    </Text>
  );

  render() {
    const { isTfReady, isModelReady, predictions, image } = this.state;

    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loadingContainer}>
          
        <Text style={{fontSize: 22, color: "#0ca3e4ff", height: 50}}>Makers - MobileNet Classification</Text>
        
          <Text style={styles.text}>TFJS ready? {isTfReady ? '✅' : ''}</Text>
          <View style={styles.loadingModelContainer}>
          <Text style={styles.text}>Model ready? </Text>
            {isModelReady ? (
              <Text style={styles.text}>✅</Text>
            ) : (
              <ActivityIndicator size="small" />
            )}
          </View>
        </View>

        <TouchableOpacity
          style={styles.imageWrapper}
          onPress={isModelReady ? this.selectImage : undefined}
        >
          {image ? (
            <Image source={image} style={styles.imageContainer} />
          ) : (
            isModelReady && (
              <Text style={styles.transparentText}>Tap to choose image</Text>
            )
          )}
        </TouchableOpacity>

        <View style={styles.predictionWrapper}>
          {isModelReady && image && (
            <Text style={styles.text}>{predictions ? '' : 'Predicting...'}</Text>
          )}
          {predictions && predictions.map(this.renderPrediction)}
        </View>

        <View style={styles.footer}>
          <Text style={styles.poweredBy}>Powered by:</Text>
          <Image source={require('./assets/tfjs.jpg')} style={styles.tfLogo} />
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#171f24', alignItems: 'center' },
  loadingContainer: { marginTop: 80, justifyContent: 'center' },
  text: { color: '#ffffff', fontSize: 16, textAlign: 'center' },
  loadingModelContainer: { flexDirection: 'row', marginTop: 10, justifyContent: 'center', alignItems: 'center' },
  imageWrapper: {
    width: 280,
    height: 280,
    padding: 10,
    borderColor: '#cf667f',
    borderWidth: 5,
    borderStyle: 'dashed',
    marginTop: 40,
    marginBottom: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: { width: 250, height: 250 },
  predictionWrapper: {
    height: 70,
    width: '100%',
    flexDirection: 'column',
    alignItems: 'center',
  },
  transparentText: { color: '#ffffff', opacity: 0.7 },
  footer: { marginTop: 40 },
  poweredBy: { fontSize: 20, color: '#e69e34', marginBottom: 6 },
  tfLogo: { width: 125, height: 70 },
});

export default App;
