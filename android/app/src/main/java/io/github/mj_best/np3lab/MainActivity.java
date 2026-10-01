package io.github.mj_best.np3lab;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SafFoldersPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
