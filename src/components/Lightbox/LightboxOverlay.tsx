import { ILightboxOverlayProps, ILightboxOverlayState } from '@interfaces/lightbox';
import React from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  PanResponderInstance,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const WINDOW_HEIGHT = Dimensions.get('window').height;
const WINDOW_WIDTH = Dimensions.get('window').width;
const DRAG_DISMISS_THRESHOLD = 150;
const isIOS = Platform.OS === 'ios';

const styles = StyleSheet.create({
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
  },
  open: {
    position: 'absolute',
    flex: 1,
    justifyContent: 'center',
    // Android pan handlers crash without this declaration:
    backgroundColor: 'transparent',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: WINDOW_WIDTH,
    backgroundColor: 'transparent',
  },
  closeButton: {
    fontSize: 35,
    color: 'white',
    lineHeight: 40,
    width: 40,
    textAlign: 'center',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowRadius: 1.5,
    shadowColor: 'black',
    shadowOpacity: 0.8,
  },
});

export default class LightboxOverlay extends React.Component<ILightboxOverlayProps, ILightboxOverlayState> {
  _panResponder: PanResponderInstance;

  static defaultProps = {
    springConfig: { tension: 30, friction: 7 },
    backgroundColor: 'black',
  };

  constructor(props: ILightboxOverlayProps) {
    super(props);
    this.state = {
      isAnimating: false,
      isPanning: false,
      target: {
        x: 0,
        y: 0,
        opacity: 1,
      },
      pan: new Animated.Value(0),
      openVal: new Animated.Value(0),
    };
    this._panResponder = PanResponder.create({
      // Ask to be the responder:
      onStartShouldSetPanResponder: () => !this.state.isAnimating,
      onStartShouldSetPanResponderCapture: () => !this.state.isAnimating,
      onMoveShouldSetPanResponder: () => !this.state.isAnimating,
      onMoveShouldSetPanResponderCapture: () => !this.state.isAnimating,

      onPanResponderGrant: () => {
        this.state.pan.setValue(0);
        this.setState({ isPanning: true });
      },
      onPanResponderMove: Animated.event([null, { dy: this.state.pan }], {
        useNativeDriver: this.props.useNativeDriver,
      }),
      onPanResponderTerminationRequest: () => true,
      onPanResponderRelease: (_, gestureState) => {
        if (Math.abs(gestureState.dy) > DRAG_DISMISS_THRESHOLD) {
          this.setState({
            isPanning: false,
            target: {
              y: gestureState.dy,
              x: gestureState.dx,
              opacity: 1 - Math.abs(gestureState.dy / WINDOW_HEIGHT),
            },
          });
          this.close();
        } else {
          Animated.spring(this.state.pan, {
            ...this.props.springConfig,
            toValue: 0,
            useNativeDriver: this.props.useNativeDriver,
          }).start(() => {
            this.setState({ isPanning: false });
          });
        }
      },
    });
  }

  componentDidMount() {
    if (this.props.isOpen) {
      this.open();
    }
  }

  open = () => {
    if (isIOS) {
      StatusBar.setHidden(true, 'fade');
    }
    this.state.pan.setValue(0);
    this.setState({
      isAnimating: true,
      target: {
        x: 0,
        y: 0,
        opacity: 1,
      },
    });

    Animated.spring(this.state.openVal, {
      ...this.props.springConfig,
      toValue: 1,
      useNativeDriver: this.props.useNativeDriver,
    }).start(() => {
      this.setState({ isAnimating: false });
      this.props.didOpen && this.props.didOpen();
    });
  };

  close = () => {
    this.props.willClose && this.props.willClose();
    if (isIOS) {
      StatusBar.setHidden(false, 'fade');
    }
    this.setState({
      isAnimating: true,
    });
    Animated.spring(this.state.openVal, {
      ...this.props.springConfig,
      toValue: 0,
      useNativeDriver: this.props.useNativeDriver,
    }).start(() => {
      this.setState({
        isAnimating: false,
      });
      this.props.onClose && this.props.onClose();
    });
  };

  componentDidUpdate(prevProps: ILightboxOverlayProps) {
    if (this.props.isOpen !== prevProps.isOpen && this.props.isOpen) {
      this.open();
    }
  }

  render() {
    const { isOpen, renderHeader, swipeToDismiss, origin, backgroundColor } = this.props;

    const { isPanning, openVal, target } = this.state;

    const lightboxOpacityStyle = {
      opacity: openVal.interpolate({ inputRange: [0, 1], outputRange: [0, target.opacity] }),
    };

    let handlers;
    if (swipeToDismiss) {
      handlers = this._panResponder.panHandlers;
    }

    let dragStyle;
    if (isPanning) {
      dragStyle = {
        top: this.state.pan,
      };
      lightboxOpacityStyle.opacity = this.state.pan.interpolate({
        inputRange: [-WINDOW_HEIGHT, 0, WINDOW_HEIGHT],
        outputRange: [0, 1, 0],
      });
    }

    const openStyle = [
      styles.open,
      {
        left: openVal.interpolate({ inputRange: [0, 1], outputRange: [origin.x, target.x] }),
        top: openVal.interpolate({
          inputRange: [0, 1],
          outputRange: [origin.y, target.y],
        }),
        width: openVal.interpolate({ inputRange: [0, 1], outputRange: [origin.width, WINDOW_WIDTH] }),
        height: openVal.interpolate({ inputRange: [0, 1], outputRange: [origin.height, WINDOW_HEIGHT] }),
      },
    ];

    const background = (
      <Animated.View style={[styles.background, { backgroundColor: backgroundColor }, lightboxOpacityStyle]} />
    );
    const header = (
      <Animated.View style={[styles.header, lightboxOpacityStyle]}>
        {renderHeader ? (
          renderHeader(this.close)
        ) : (
          <TouchableOpacity onPress={this.close}>
            <Text style={styles.closeButton}>×</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    );
    const content = (
      <Animated.View style={[openStyle, dragStyle]} {...handlers}>
        {this.props.children}
      </Animated.View>
    );

    if (this.props.navigator) {
      return (
        <View>
          {background}
          {content}
          {header}
        </View>
      );
    }

    return (
      <Modal visible={isOpen} transparent={true} onRequestClose={() => this.close()}>
        {background}
        {content}
        {header}
      </Modal>
    );
  }
}